'use strict';
const DAY=86400000;
function articleDecision(article,{category,now=Date.now()}={}){
 let u;try{u=new URL(article.url);}catch{return 'article_link';}
 const verified=Date.parse(article.verifiedAt),published=Date.parse(article.publishedAt),applied=Date.parse(article.applicabilityVerifiedAt);
 if(u.protocol!=='https:'||article.primarySource!==true||article.linkVerified!==true||!article.title||!article.relevanceReason||!article.categories?.includes(category)||!Number.isFinite(verified)||verified>now||now-verified>7*DAY)return 'article_evidence';
 if(article.kind==='news')return Number.isFinite(published)&&published<=now&&now-published<=14*DAY?null:'stale_news';
 if(article.kind==='technical')return Number.isFinite(published)&&published<=now&&now-published<=365*DAY&&Number.isFinite(applied)&&applied<=now&&now-applied<=30*DAY?null:'technical_applicability_review';
 return 'article_type_unreviewed';
}
function editorialGate(campaign,now=Date.now()){
 const articles=campaign.articles||[];
 if(campaign.audience==='trade_news'&&!articles.length)return 'current_articles_required';
 return articles.map(a=>articleDecision(a,{category:campaign.category,now})).find(Boolean)||null;
}
module.exports={articleDecision,editorialGate};
