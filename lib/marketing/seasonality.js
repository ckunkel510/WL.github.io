'use strict';
const AREAS=require('../../marketing/store-weather-areas.json');
const HOUR=3600000;
const at=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:null;};
function seasonAt(value){const n=at(value);if(n===null)return null;const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'numeric'}).format(n));return month<=2||month===12?'winter':month<=5?'spring':month<=8?'summer':'fall';}
function weatherSignals(snapshot,{now=Date.now(),releaseAt=new Date(now).toISOString()}={}){
 const issued=at(snapshot?.issuedAt),checked=at(snapshot?.checkedAt),release=at(releaseAt);
 let source;try{source=new URL(snapshot.source);}catch{return {ok:false,reason:'weather_source'};}
 if(!AREAS[snapshot?.store]||source.protocol!=='https:'||source.hostname!=='api.weather.gov'||release===null||issued===null||checked===null||issued>now||checked>now||now-issued>24*HOUR||now-checked>24*HOUR)return {ok:false,reason:'weather_stale_or_unverified'};
 const periods=(snapshot.periods||[]).filter(p=>at(p.startsAt)!==null&&at(p.endsAt)!==null&&at(p.endsAt)>release&&at(p.startsAt)<release+72*HOUR);
 if(!periods.some(p=>at(p.startsAt)<=release&&at(p.endsAt)>release))return {ok:false,reason:'outside_forecast_horizon'};
 const severe=(snapshot.alerts||[]).some(a=>['Extreme','Severe'].includes(a.severity)&&at(a.expiresAt)>release);
 return {ok:true,store:snapshot.store,severeAlert:severe,signals:[...(periods.some(p=>Number.isFinite(p.rainProbability)&&p.rainProbability>=60)?['rain_prep']:[]),...(periods.some(p=>Number.isFinite(p.temperatureF)&&p.temperatureF<=32)?['freeze_prep']:[]),...(periods.some(p=>Number.isFinite(p.temperatureF)&&p.temperatureF>=95)?['heat_prep']:[])],source:snapshot.source,checkedAt:snapshot.checkedAt};
}
function seasonalGate(campaign,weatherByStore={},now=Date.now()){
 const rules=campaign?.seasonality,season=seasonAt(new Date(now).toISOString());
 if(!rules||!Array.isArray(rules.allowedSeasons)||!rules.allowedSeasons.includes(season))return 'season_mismatch_or_unreviewed';
 if(!rules.weatherSignal)return null;
 const stores=campaign.targeting?.stores||[];
 if(!stores.length||!['rain_prep','freeze_prep','heat_prep'].includes(rules.weatherSignal))return 'weather_scope';
 for(const store of stores){const weather=weatherByStore[store];if(weather?.store!==store)return 'weather_store_mismatch';const context=weatherSignals(weather,{now});if(!context.ok)return context.reason;if(context.severeAlert)return 'severe_weather_hold';if(!context.signals.includes(rules.weatherSignal))return 'weather_changed';}
 return null;
}
async function fetchStoreWeather(store,{fetchImpl=fetch,now=Date.now()}={}){
 const area=AREAS[store];if(!area)throw Error('Known Woodson store area required');
 async function read(url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='api.weather.gov')throw Error('NWS source required');const response=await fetchImpl(u.href,{headers:{'User-Agent':'WoodsonEmailStudio/1.0 (https://www.woodsonlumber.com)','Accept':'application/geo+json'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('NWS response '+response.status);return response.json();}
 const point=await read(`https://api.weather.gov/points/${area.latitude},${area.longitude}`);
 const source=point.properties?.forecast;if(!source)throw Error('NWS forecast unavailable');
 const [forecast,alerts]=await Promise.all([read(source),read(`https://api.weather.gov/alerts/active?point=${area.latitude},${area.longitude}`)]);
 return {store,source,issuedAt:forecast.properties?.updateTime,checkedAt:new Date(now).toISOString(),periods:(forecast.properties?.periods||[]).map(p=>({startsAt:p.startTime,endsAt:p.endTime,temperatureF:typeof p.temperature==='number'?(p.temperatureUnit==='C'?p.temperature*9/5+32:p.temperature):null,rainProbability:p.probabilityOfPrecipitation?.value??null,summary:p.shortForecast})),alerts:(alerts.features||[]).map(x=>({event:x.properties?.event,severity:x.properties?.severity,expiresAt:x.properties?.expires})),scope:'Public branch area; no customer geolocation'};
}
module.exports={seasonAt,weatherSignals,seasonalGate,fetchStoreWeather};
