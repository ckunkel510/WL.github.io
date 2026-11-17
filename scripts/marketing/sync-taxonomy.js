#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const groups=JSON.parse(fs.readFileSync(path.join(root,'marketing/taxonomy.json'),'utf8'));
const interests=Object.assign({},...Object.values(groups));
for(const [key,label] of Object.entries(interests)) if(!/^[a-z][a-z_]{1,39}$/.test(key)||typeof label!=='string'||label.length>70) throw new Error('Invalid taxonomy entry');
function update(file,name){const p=path.join(root,file),s=fs.readFileSync(p,'utf8'),rx=new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\s*\\};`);if(!rx.test(s))throw new Error('Taxonomy marker missing: '+file);fs.writeFileSync(p,s.replace(rx,`const ${name} = ${JSON.stringify(interests,null,2)};`));}
update('Signupvalidation.js','INTERESTS');update('integrations/constant-contact/MarketingSetup.gs','WL_INTERESTS');
console.log(`Synchronized ${Object.keys(interests).length} consented interests and trade specialties`);
