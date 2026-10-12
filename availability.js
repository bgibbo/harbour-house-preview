/* Public availability is fetched from the read-only, date-only Apps Script endpoint. */
(function(global){
'use strict';
const DAY=86400000;
const iso=d=>d.toISOString().slice(0,10);
const addDays=(date,n)=>iso(new Date(Date.parse(date+'T12:00:00Z')+n*DAY));
const monthDate=(year,month,day=1)=>iso(new Date(Date.UTC(year,month,day,12)));
const todayDublin=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00Z'))&&iso(new Date(d+'T12:00:00Z'))===d;
function classifyEnquiryStatus(payload,requestId){
 if(!payload||payload.requestId!==requestId)return null;
 if(payload.status==='accepted')return {mode:'live',acknowledgement:'accepted'};
 if(payload.status==='partial')return {mode:'live',acknowledgement:'failed'};
 if(payload.status==='failed')return {error:'We could not send your enquiry. Please contact us directly before trying again.'};
 return null;
}
function jsonp(url,prefix,timeoutMs=15000){
 return new Promise((resolve,reject)=>{
  const callbackName=prefix+(Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2)+Date.now().toString(16)).slice(0,40);
  const script=document.createElement('script');let timer;
  const clean=()=>{clearTimeout(timer);delete window[callbackName];script.remove()};
  window[callbackName]=payload=>{clean();resolve(payload)};
  script.onerror=()=>{clean();reject(Error('The availability service could not be reached.'))};
  const requestUrl=new URL(url);requestUrl.searchParams.set('callback',callbackName);requestUrl.searchParams.set('_',String(Date.now()));script.src=requestUrl.href;
  timer=setTimeout(()=>{clean();reject(Error('The availability service did not respond.'))},timeoutMs);
  document.head.append(script);
 });
}
const provider={async load({from,to}){
  const endpoint=global.HARBOUR_AVAILABILITY_ENDPOINT||global.HARBOUR_ENQUIRY_ENDPOINT;
  if(!endpoint||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))throw Error('Live availability is not configured.');
  const url=new URL(endpoint);url.searchParams.set('action','availability');url.searchParams.set('from',from);url.searchParams.set('to',to);
  return jsonp(url.href,'__hhAvailability_');
}};
function normalize(raw,expected){
  if(!raw||raw.status!=='ok'||raw.timeZone!=='Europe/Dublin'||!validDate(raw.from)||!validDate(raw.to)||raw.to<=raw.from||!Array.isArray(raw.busy))throw Error('Invalid availability response');
  if(expected&&(raw.from!==expected.from||raw.to!==expected.to))throw Error('Availability response did not match the requested date range');
  const busy=raw.busy.map(x=>{if(!validDate(x.start)||!validDate(x.end)||x.end<=x.start)throw Error('Invalid blocked interval');return {start:x.start,end:x.end}});
  return {mode:'live',timeZone:raw.timeZone,from:raw.from,to:raw.to,busy};
}
const isBusy=(data,date)=>data.busy.some(x=>date>=x.start&&date<x.end);
function checkStay(data,arrival,departure,today){
  if(!validDate(arrival)||!validDate(departure)||departure<=arrival)return {ok:false,reason:'Departure must be after arrival.'};
  if(arrival<today)return {ok:false,reason:'Choose an arrival from today onwards.'};
  if(!data||arrival<data.from||departure>data.to)return {ok:false,reason:'Availability cannot be checked for those dates. Please contact us.'};
  if(data.busy.some(x=>arrival<x.end&&departure>x.start))return {ok:false,reason:'Those nights overlap booked dates. Please choose another stay.'};
  return {ok:true,nights:Math.round((Date.parse(departure+'T12:00:00Z')-Date.parse(arrival+'T12:00:00Z'))/DAY)};
}
global.HarbourAvailability={provider,normalize,checkStay,isBusy,addDays,monthDate,todayDublin,classifyEnquiryStatus};
})(typeof window!=='undefined'?window:globalThis);

if(typeof document!=='undefined'){
(function(){
'use strict';
const A=window.HarbourAvailability,today=A.todayDublin(),first=new Date(today+'T12:00:00Z');
const base=first.getUTCFullYear()*12+first.getUTCMonth(),last=base+17;
const dateFor=(m,d=1)=>A.monthDate(Math.floor(m/12),m%12,d);
let view=base,data=null,pickArrival='',pickDeparture='';
const mobile=matchMedia('(max-width:700px)');
const form=document.querySelector('#enquiry-form'),arrival=form.elements.arrival,departure=form.elements.departure;
arrival.min=today;departure.min=A.addDays(today,1);
const status=document.querySelector('#availability-status'),summary=document.querySelector('#selected-dates'),cta=document.querySelector('#dates-enquiry');
const format=(date,options={day:'numeric',month:'short',year:'numeric'})=>new Intl.DateTimeFormat('en-IE',{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
function message(s){status.textContent=s}
function resetResult(){document.querySelector('#draft').hidden=true;document.querySelector('#form-error').textContent=''}
function setSelection(a,b){
 pickArrival=a;pickDeparture=b;arrival.value=a;departure.value=b;
 departure.min=a?A.addDays(a,1):A.addDays(today,1);resetResult();
 const check=b?A.checkStay(data,a,b,today):null,ready=!!check?.ok;
 cta.setAttribute('aria-disabled',String(!ready));
 summary.textContent=ready?format(a)+' – '+format(b)+' · '+check.nights+' night'+(check.nights===1?'':'s'):a?'Arrival: '+format(a)+' · choose departure':'Select your arrival date';
 render();
}
function select(date){
 if(!pickArrival||pickDeparture||date<=pickArrival){
  if(A.isBusy(data,date)){message('This date is booked. Choose an available arrival.');return}
  setSelection(date,'');message('Arrival selected. Now choose your departure.');return;
 }
 const check=A.checkStay(data,pickArrival,date,today);
 if(!check.ok){message(check.reason);return}
 setSelection(pickArrival,date);message('Dates selected. Continue to enquire; your stay is confirmed personally.');
}
function render(){
 const focusedDate=document.activeElement?.dataset?.date;
 const count=mobile.matches?1:2;const host=document.querySelector('#calendar-months');host.replaceChildren();
 document.querySelector('#calendar-period').textContent=format(dateFor(view),{month:'long',year:'numeric'})+(count===2?' – '+format(dateFor(view+1),{month:'long',year:'numeric'}):'');
 document.querySelector('#previous-month').disabled=view<=base;
 document.querySelector('#next-month').disabled=view+count-1>=last;
 for(let offset=0;offset<count;offset++){
  const m=view+offset,section=document.createElement('section');section.className='calendar-month';
  const heading=document.createElement('h3');heading.textContent=format(dateFor(m),{month:'long',year:'numeric'});section.append(heading);
  const grid=document.createElement('div');grid.className='calendar-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label',heading.textContent);
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(day=>{const s=document.createElement('span');s.className='weekday';s.textContent=day;grid.append(s)});
  const weekday=(new Date(dateFor(m)+'T12:00:00Z').getUTCDay()+6)%7;
  for(let x=0;x<weekday;x++){const s=document.createElement('span');s.setAttribute('aria-hidden','true');grid.append(s)}
  const days=new Date(Date.UTC(Math.floor(m/12),m%12+1,0)).getUTCDate();
  for(let day=1;day<=days;day++){
   const date=dateFor(m,day),button=document.createElement('button');button.type='button';button.textContent=day;button.dataset.date=date;
   const past=date<today,unknown=!data||date<data.from||date>=data.to,busy=data&&A.isBusy(data,date);
   const checkout=busy&&pickArrival&&!pickDeparture&&A.checkStay(data,pickArrival,date,today).ok;
   const selected=date===pickArrival||date===pickDeparture,inStay=pickArrival&&pickDeparture&&date>pickArrival&&date<pickDeparture;
   button.className='calendar-day'+(busy?' booked':' available')+(checkout?' checkout-only':'')+(selected?' selected':'')+(inStay?' in-stay':'');
   button.disabled=!!(past||unknown||(busy&&!checkout));
   button.setAttribute('aria-pressed',String(selected||!!inStay));
   button.setAttribute('aria-label',format(date)+', '+(past?'past date':unknown?'availability unknown':checkout?'available for departure only':busy?'booked night':'available night')+(date===pickArrival?', selected arrival':'')+(date===pickDeparture?', selected departure':''));
   button.title=checkout?'Departure only; this night is booked':busy?'Booked night':'Available night';
   button.onclick=()=>select(date);grid.append(button);
  }
  section.append(grid);host.append(section);
 }
 if(focusedDate){const target=host.querySelector('[data-date="'+focusedDate+'"]');if(target&&!target.disabled)target.focus({preventScroll:true})}
}
document.querySelector('#previous-month').onclick=()=>{view=Math.max(base,view-1);render()};
document.querySelector('#next-month').onclick=()=>{view=Math.min(last-(mobile.matches?0:1),view+1);render()};
mobile.addEventListener('change',()=>{view=Math.min(view,last-(mobile.matches?0:1));render()});
document.querySelector('#clear-dates').onclick=()=>{setSelection('','');message('Dates cleared. Choose an arrival.')};
cta.onclick=e=>{if(cta.getAttribute('aria-disabled')==='true'){e.preventDefault();message('Select an arrival and departure first.')}else{form.elements.guests.focus({preventScroll:true})}};
arrival.onchange=departure.onchange=()=>{
 resetResult();pickArrival=arrival.value;pickDeparture=departure.value;departure.min=pickArrival?A.addDays(pickArrival,1):A.addDays(today,1);
 const check=pickDeparture?A.checkStay(data,pickArrival,pickDeparture,today):null;
 cta.setAttribute('aria-disabled',String(!check?.ok));summary.textContent=check?.ok?format(pickArrival)+' – '+format(pickDeparture)+' · '+check.nights+' nights':pickArrival?'Arrival: '+format(pickArrival)+' · choose departure':'Select your arrival date';
 message(check&&!check.ok?check.reason:'Your enquiry dates are reflected in the calendar.');render();
};
form.addEventListener('input',resetResult);
 let deliveryMode='unavailable',previousBody='',requestKey='';
const submit=form.querySelector('button[type="submit"]');
 const googleEndpoint=window.HARBOUR_ENQUIRY_ENDPOINT||'';
 function enableLive(){
  deliveryMode='google';submit.textContent='Send enquiry';submit.disabled=false;
  document.querySelector('.booking-note').textContent='Send an enquiry to the owner. Requested dates remain subject to personal confirmation; submitting does not reserve them.';
  document.querySelector('.form-privacy').textContent='Your details are sent through Google to deliver your enquiry and acknowledgement. No booking or calendar event is created.';
 }
 function sendViaGoogle(fields,key){
  return new Promise((resolve,reject)=>{
   if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(googleEndpoint)){reject(Error('The enquiry email service is not configured yet. Please contact us directly.'));return}
   const frame=document.createElement('iframe');frame.name='hh-enquiry-'+key.replace(/[^a-zA-Z0-9-]/g,'');frame.title='Enquiry submission transport';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:absolute;width:1px;height:1px;left:-10000px;border:0';
   const transport=document.createElement('form');transport.method='POST';transport.action=googleEndpoint;transport.target=frame.name;transport.acceptCharset='UTF-8';transport.style.display='none';
   const values={...fields,request_id:key};
   for(const [name,value] of Object.entries(values)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value??'');transport.append(input)}
   const callbackName='__hhStatus_'+(Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2)+Date.now().toString(16)).slice(0,40);
   let timer,pollTimer,currentScript,finished=false;
   const clean=()=>{finished=true;clearTimeout(timer);clearTimeout(pollTimer);if(currentScript)currentScript.remove();delete window[callbackName];transport.remove();frame.remove()};
   window[callbackName]=payload=>{
    if(finished)return;
    const result=A.classifyEnquiryStatus(payload,key);if(!result)return;
    clean();if(result.error)reject(Error(result.error));else resolve(result);
   };
   const poll=()=>{
    if(finished)return;
    currentScript=document.createElement('script');currentScript.async=true;
    const statusUrl=new URL(googleEndpoint);statusUrl.searchParams.set('action','status');statusUrl.searchParams.set('request_id',key);statusUrl.searchParams.set('callback',callbackName);statusUrl.searchParams.set('_',String(Date.now()));
    currentScript.src=statusUrl.href;
    currentScript.onload=currentScript.onerror=()=>{if(currentScript)currentScript.remove();if(!finished)pollTimer=setTimeout(poll,1200)};
    document.head.append(currentScript);
   };
   document.body.append(frame,transport);
   timer=setTimeout(()=>{clean();reject(Error('We have not received the final status yet. Your enquiry may have been received, so please check your email and contact us before submitting again.'))},60000);
   try{transport.submit();poll()}catch(error){clean();reject(Error('We could not send your enquiry. Please contact us directly.'))}
  });
 }
 if(googleEndpoint&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(googleEndpoint))enableLive();
 else{submit.disabled=true;submit.textContent='Enquiries temporarily unavailable';document.querySelector('.booking-note').textContent='Please contact us directly to ask about your stay.';}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(submit.disabled)return;
 const fields=Object.fromEntries(new FormData(form)),error=document.querySelector('#form-error');
 const check=A.checkStay(data,fields.arrival,fields.departure,today);
 if(!check.ok){error.textContent=check.reason;return}
 if(!/^[1-6]$/.test(fields.guests)||!fields.name.trim()||!fields.phone.trim()){error.textContent='Please enter your name, contact number and one to six guests.';return}
 if(fields.website){error.textContent='Unable to submit. Please contact us directly.';return}
 error.textContent='';document.querySelector('#draft').hidden=true;
 const body=JSON.stringify(fields);if(body!==previousBody){requestKey='hh-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);previousBody=body;}
 const controls=[...form.elements];controls.forEach(c=>c.disabled=true);submit.textContent='Preparing your enquiry…';
 try{
   const result=await sendViaGoogle(fields,requestKey);
  document.querySelector('.result-label').textContent='ENQUIRY RECEIVED';
   document.querySelector('#result-intro').textContent='We have received your request for 3 Harbour House, Dunmore East.';
  document.querySelector('#result-stay').textContent='Requested stay: '+format(fields.arrival)+' – '+format(fields.departure)+' · '+fields.guests+' guest'+(fields.guests==='1'?'':'s');
   document.querySelector('#result-next').textContent='We will confirm availability and booking details with you shortly. '+(result.acknowledgement==='accepted'?'An acknowledgement email has also been sent.':result.acknowledgement==='failed'?'Your enquiry reached the owner, but the automatic acknowledgement could not be sent. Please do not submit it again.':'');
  document.querySelector('#draft-text').textContent=result.ownerText||'Enquiry — 3 Harbour House\n\nName: '+fields.name+'\nEmail: '+fields.email+'\nMobile / contact: '+fields.phone+'\nArrival: '+fields.arrival+'\nDeparture: '+fields.departure+'\nNights: '+check.nights+'\nGuests: '+fields.guests+'\n\n'+(fields.message||'Please confirm availability and the total price for these dates.');
  document.querySelector('#draft').hidden=false;document.querySelector('#copy-status').textContent='';
  document.querySelector('#enquiry-result').focus({preventScroll:true});document.querySelector('#draft').scrollIntoView({block:'start',behavior:'smooth'});
 }catch(err){error.textContent=err.name==='AbortError'?'We could not confirm delivery. Retry with the same details or contact us directly.':err.message;}
  finally{controls.forEach(c=>c.disabled=false);submit.textContent='Send enquiry';}
});

document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(document.querySelector('#draft-text').textContent);document.querySelector('#copy-status').textContent='Enquiry details copied.'}catch{document.querySelector('#copy-status').textContent='Select and copy the draft text above.'}};
render();message('Loading live availability…');
const requested={from:today.slice(0,7)+'-01',to:dateFor(last+1)};
A.provider.load(requested).then(raw=>{data=A.normalize(raw,requested);render();message('Live availability loaded. Choose an arrival date.')}).catch(()=>{data=null;render();message('Live availability is temporarily unavailable. Please contact us; no dates are shown as available.')});
})();
}
