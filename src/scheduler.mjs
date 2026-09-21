import { id, now, postView, settings, audit } from './db.mjs';
import { aggregate, AppError, validateReady } from './domain.mjs';

export function createScheduler(db,provider) {
  let busy=false;
  function setStatus(postId) { const deliveries=db.prepare('SELECT * FROM deliveries WHERE post_id=?').all(postId); db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run(aggregate(deliveries),now(),postId); }
  function enqueue(postId,actor) {
    const post=postView(db,db.prepare('SELECT * FROM posts WHERE id=?').get(postId));
    if (!post) throw new AppError('Post not found.',404);
    if (['published','publishing','partial','needs_attention'].includes(post.status)) throw new AppError('This post has already entered publishing. Review its individual delivery results.',409);
    const media=post.mediaIds.map(mid=>db.prepare('SELECT * FROM media WHERE id=?').get(mid));
    const errors=validateReady(post,media); if(errors.length) throw new AppError(errors.join('\n'));
    if(!provider.configured) throw new AppError('Connect a publishing provider before publishing. Your draft remains saved.',503);
    const location=settings(db).locations.find(l=>l.id===post.locationId);
    if(!location?.profile) throw new AppError('Select a location with a linked publishing profile.');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const platform of post.platforms) db.prepare('INSERT INTO deliveries(id,post_id,platform,profile,status,request_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id(),postId,platform,location.profile,'queued',id(),now(),now());
      db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('publishing',now(),postId);
      audit(db,actor,'publish_requested',postId); db.exec('COMMIT');
    } catch(e) {db.exec('ROLLBACK');throw e;}
  }
  async function tick() {
    if(busy)return;busy=true;
    try {
      for(const row of db.prepare("SELECT * FROM posts WHERE status='scheduled' AND scheduled_at<=?").all(now())) {
        try{enqueue(row.id,'scheduler');}catch(e){db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('needs_attention',now(),row.id);audit(db,'scheduler',`schedule_blocked: ${e.message}`,row.id);}
      }
      for(const delivery of db.prepare("SELECT * FROM deliveries WHERE status IN ('queued','processing') AND (next_check IS NULL OR next_check<=?) ORDER BY created_at LIMIT 12").all(now())) {
        const post=postView(db,db.prepare('SELECT * FROM posts WHERE id=?').get(delivery.post_id));
        if(!provider.configured) {db.prepare('UPDATE deliveries SET status=?,message=?,updated_at=? WHERE id=?').run('needs_attention','Publishing provider is not configured.',now(),delivery.id);setStatus(post.id);continue;}
        if(delivery.status==='queued') {
          // Persist the intent before network I/O. A crash recovers by polling, never blindly reposting.
          db.prepare('UPDATE deliveries SET status=?,attempts=attempts+1,next_check=?,updated_at=? WHERE id=?').run('processing',new Date(Date.now()+15000).toISOString(),now(),delivery.id);
          try {
            const media=post.mediaIds.map(mid=>db.prepare('SELECT * FROM media WHERE id=?').get(mid));
            const result=await provider.send(post,delivery,media);
            if(result.request_id && result.request_id!==delivery.request_id) db.prepare('UPDATE deliveries SET request_id=? WHERE id=?').run(result.request_id,delivery.id);
          } catch(e) {
            db.prepare('UPDATE deliveries SET message=?,updated_at=? WHERE id=?').run('Upload result is uncertain. Checking with the provider before any further action.',now(),delivery.id);
          }
        } else {
          try {
            const result=await provider.status(delivery);
            const tooOld=Date.now()-Date.parse(delivery.created_at)>24*60*60*1000;
            if(tooOld && result.status==='processing') {result.status='needs_attention';result.message='Still unconfirmed after 24 hours. Check the provider dashboard before retrying.';}
            db.prepare('UPDATE deliveries SET status=?,message=?,url=?,remote_id=?,next_check=?,updated_at=? WHERE id=?').run(result.status,result.message,result.url||null,result.remote_id||null,new Date(Date.now()+30000).toISOString(),now(),delivery.id);
          } catch(e) {
            const tooOld=Date.now()-Date.parse(delivery.created_at)>60*60*1000;
            db.prepare('UPDATE deliveries SET status=?,message=?,next_check=?,updated_at=? WHERE id=?').run(tooOld?'needs_attention':'processing',tooOld?'Could not confirm publication. Check the provider dashboard; this app will not repost automatically.':'Provider status temporarily unavailable; checking again.',new Date(Date.now()+60000).toISOString(),now(),delivery.id);
          }
        }
        setStatus(post.id);
      }
    } finally {busy=false;}
  }
  return {enqueue,tick,setStatus};
}
