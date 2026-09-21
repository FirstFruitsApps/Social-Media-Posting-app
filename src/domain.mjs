export const platforms = [
  { id: 'google_business', name: 'Google Business', short: 'G', color: '#4285f4', kinds: ['photo'], limit: 1500, maxPhotos: 1 },
  { id: 'facebook', name: 'Facebook', short: 'f', color: '#1877f2', kinds: ['photo','video'], limit: 63206, maxPhotos: 10 },
  { id: 'instagram', name: 'Instagram', short: '◎', color: '#b43883', kinds: ['photo','video'], limit: 2200, maxPhotos: 10 },
  { id: 'pinterest', name: 'Pinterest', short: 'P', color: '#bd081c', kinds: ['photo','video'], limit: 500, maxPhotos: 1 },
  { id: 'tiktok', name: 'TikTok', short: '♪', color: '#171717', kinds: ['video'], limit: 2200, maxPhotos: 0 },
  { id: 'youtube', name: 'YouTube', short: '▶', color: '#e62117', kinds: ['video'], limit: 5000, maxPhotos: 0 }
];
export class AppError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export function safeUrl(value, required=false) {
  if (!value && !required) return '';
  try { const u=new URL(value); if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw 0; return u.href; } catch { throw new AppError('Use a valid http or https website link.'); }
}
export function normalizePost(input, db) {
  if (!input || typeof input!=='object' || (input.mediaIds!==undefined&&!Array.isArray(input.mediaIds)) || (input.platforms!==undefined&&!Array.isArray(input.platforms))) throw new AppError('Invalid post fields.');
  if (!['photo','video'].includes(input.kind)) throw new AppError('Choose a photo or video post.');
  const text=(v,max) => String(v??'').trim().slice(0,max);
  const title=text(input.title,120); if (!title) throw new AppError('Add a post name.');
  const mediaIds=[...new Set(input.mediaIds||[])];
  if (mediaIds.length>10) throw new AppError('Use at most 10 photos or one video.');
  const media=mediaIds.map(mid => db.prepare('SELECT * FROM media WHERE id=?').get(String(mid)));
  if (media.some(m=>!m)) throw new AppError('One of the selected files is no longer available.');
  if (media.some(m=>!m.type.startsWith(input.kind==='photo'?'image/':'video/'))) throw new AppError('Photo and video posts use separate uploads.');
  if (input.kind==='video' && media.length>1) throw new AppError('Choose one video per post.');
  const targets=[...new Set(input.platforms||[])];
  if (targets.some(p=>!platforms.find(x=>x.id===p && x.kinds.includes(input.kind)))) throw new AppError('One of the destinations does not support this post type.');
  const variants={};
  for (const p of targets) { const val=input.variants?.[p]; if (val) variants[p]=text(val,65000); }
  const options={};
  const fields=['facebook_page_id','pinterest_board_id','gbp_location_id','youtube_title','privacy_level','youtube_privacy','made_for_kids','brand_organic_toggle','brand_content_toggle','disable_comment','disable_duet','disable_stitch','consent'];
  for (const key of fields) if (input.options?.[key]!==undefined) options[key]=typeof input.options[key]==='boolean'?input.options[key]:text(input.options[key],300);
  let scheduledAt=input.scheduled_at||null;
  if (scheduledAt) { if (!Number.isFinite(Date.parse(scheduledAt))) throw new AppError('Choose a valid date and time.'); scheduledAt=new Date(scheduledAt).toISOString(); }
  return { title, kind:input.kind, caption:text(input.caption,65000), mediaIds, platforms:targets, variants, options, product:text(input.product,2000), price:text(input.price,100), offer:text(input.offer,1000), link:safeUrl(text(input.link,2000)), locationId:text(input.locationId,100), scheduled_at:scheduledAt };
}
export function validateReady(post, media) {
  const errors=[];
  if (!post.mediaIds.length) errors.push('Upload at least one file.');
  if (!post.platforms.length) errors.push('Select at least one destination.');
  if (!post.caption.trim()) errors.push('Write a caption.');
  for (const name of post.platforms) {
    const p=platforms.find(x=>x.id===name); const caption=post.variants[name]||post.caption;
    if (caption.length>p.limit) errors.push(`${p.name}: caption exceeds ${p.limit} characters.`);
    if (post.kind==='photo' && media.length>p.maxPhotos) errors.push(`${p.name}: this release supports ${p.maxPhotos} photo${p.maxPhotos===1?'':'s'} per post. Duplicate this draft to select different photos.`);
    if (name==='instagram' && post.kind==='photo' && media.some(m=>m.type!=='image/jpeg')) errors.push('Instagram photos must be JPEG. Use the crop/export tool to create a JPEG copy.');
  }
  if (post.platforms.includes('pinterest') && !post.options.pinterest_board_id) errors.push('Choose a Pinterest board.');
  if (post.platforms.includes('youtube') && (!post.options.youtube_title || post.options.youtube_title.length>100)) errors.push('YouTube needs a title of 1–100 characters.');
  if (post.platforms.includes('youtube') && !['public','private','unlisted'].includes(post.options.youtube_privacy)) errors.push('Choose YouTube visibility.');
  if (post.platforms.includes('youtube') && typeof post.options.made_for_kids!=='boolean') errors.push('Choose the YouTube audience.');
  if (post.platforms.includes('tiktok') && (!post.options.privacy_level || !post.options.consent)) errors.push('Choose TikTok visibility and confirm the music/content declaration.');
  if (post.platforms.includes('tiktok') && post.options.brand_content_toggle && post.options.privacy_level==='SELF_ONLY') errors.push('TikTok paid partnerships cannot use private visibility.');
  return errors;
}
export function aggregate(deliveries) {
  if (!deliveries.length) return 'draft';
  if (deliveries.every(d=>d.status==='published')) return 'published';
  if (deliveries.some(d=>['queued','processing'].includes(d.status))) return 'publishing';
  if (deliveries.some(d=>d.status==='published')) return 'partial';
  return 'needs_attention';
}
export function normalizeResult(data, platform) {
  const result=Array.isArray(data.results)?data.results.find(r=>r.platform===platform):data.results?.[platform];
  if (!result) return { status: data.status==='failed'?'needs_attention':'processing', message:data.status==='failed'?'Provider could not confirm publication. Review the provider dashboard before retrying.':'Awaiting platform confirmation.' };
  if (result.fallback_to_inbox || result.post_mode==='MEDIA_UPLOAD') return {status:'manual_action',message:'Sent to TikTok inbox. Open TikTok to finish publishing.'};
  if (result.skipped || ['failed','skipped'].includes(result.status) || result.success===false) return {status:'needs_attention',message:String(result.error||result.message||result.skip_reason||'Publishing failed.').slice(0,500)};
  if (['queued','processing','retryable'].includes(result.status) || /queued|processing/i.test(result.message||'')) return {status:'processing',message:'Platform is processing this post.'};
  const url=result.post_url||result.url; const postId=result.post_id||result.id;
  if (result.status==='completed' || (result.success===true && (url||postId||/published/i.test(result.message||'')))) {
    return {status:'published',message:'Publication confirmed by provider.',url:typeof url==='string' && /^https:\/\//.test(url)?url:null,remote_id:postId?String(postId):null};
  }
  return {status:'processing',message:'Awaiting platform confirmation.'};
}
