export function zonedInput(iso,zone) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function localTimeToUtc(value,zone) {
  if(!value)return null;
  const naive=Date.parse(value+'Z');if(!Number.isFinite(naive))throw new Error('Choose a valid date and time.');
  const matches=new Set();
  for(const delta of [-36,-24,-12,0,12,24,36]) {
    const sample=naive+delta*3600000;
    const local=Date.parse(zonedInput(sample,zone)+'Z');const offset=local-sample;
    const candidate=naive-offset;
    if(zonedInput(candidate,zone)===value)matches.add(new Date(candidate).toISOString());
  }
  if(matches.size!==1)throw new Error(matches.size?'This time occurs twice due to daylight saving. Choose a different time.':'This time does not exist due to daylight saving. Choose a different time.');
  return [...matches][0];
}
