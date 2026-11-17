#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {buildBrief} = require('../../lib/marketing/policy');
const [briefPath, catalogPath, outputPath] = process.argv.slice(2);
if (!briefPath || !catalogPath || !outputPath) throw new Error('Usage: node scripts/marketing/build-brief.js brief.json catalog.json output.json');
const plan = buildBrief(JSON.parse(fs.readFileSync(briefPath, 'utf8')), JSON.parse(fs.readFileSync(catalogPath, 'utf8')));
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({status: plan.status, products: plan.products.length, blockers: plan.blockers}));
