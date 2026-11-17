#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {fetchStoreWeather}=require('../../lib/marketing/seasonality');
const stores=process.argv.slice(2);if(!stores.length)throw Error('Provide known store slugs; output is a review snapshot, not a send trigger');
(async()=>{const snapshots=[];for(const store of stores){try{snapshots.push(await fetchStoreWeather(store));}catch(error){snapshots.push({store,status:'blocked',reason:error.message});}}fs.writeFileSync('weather-review.json',JSON.stringify({checkedAt:new Date().toISOString(),snapshots},null,2)+'\n');console.log(JSON.stringify(snapshots.map(x=>({store:x.store,status:x.status||'verified_forecast',periods:x.periods?.length||0}))));})();
