export const statuses = {learning:'I’m learning',learned:'I learned',curious:'I’m curious about'};
export const categories = ['Grammar','Vocabulary','Listening','Conversation','Pronunciation'];
export const koreanReview = {
 Grammar:['은/는','이/가','을/를','에 / 에서','하고 / (이)랑','있다 / 없다','-아요 / -어요','-았어요 / -었어요','-(으)ㄹ 거예요','-고 있다','-고 싶다','-(으)ㄹ 수 있다 / 없다','-아/어 보다','-아/어야 하다','-아/어도 되다','-(으)면 안 되다','-지 않다 / 안','-지 못하다 / 못','-고','-아/어서','-(으)니까','-지만','-(으)면','-(으)려고','-기 전에','-(으)ㄴ 후에','-(으)면서','-는데 / -(으)ㄴ데','-(으)ㄴ/는 것 같다','-아/어 본 적이 있다','-게 되다','-기로 하다','-아/어 놓다','-아/어 버리다','-는 중이다','-(으)ㄹ 때','-(으)ㄹ 텐데','-는 바람에','-더라고요','-잖아요','-거든요','-다고 하다'],
 Vocabulary:['Family and relationships','Food and ingredients','Cooking verbs','Rooms and household objects','Daily routines','Time and dates','Numbers and counters','Weather and seasons','Directions and transport','Shopping and prices','Work and study','Feelings and descriptions','Health and body','Gaming vocabulary','Common action verbs'],
 Listening:['Recognize sentence endings in a short clip','Write down one sentence from a video','Compare a clip with its Korean subtitles','Listen for numbers and counters','Identify unfamiliar words in a conversation','Follow a short clip without subtitles'],
 Conversation:['Introduce myself','Describe what I did yesterday','Explain a plan for tomorrow','Ask a follow-up question','Ask someone to repeat or explain','Give a reason for an opinion','Tell a short story','Compare two choices'],
 Pronunciation:['받침 — final consonants','연음 — linking sounds','ㄱ / ㄲ / ㅋ','ㄷ / ㄸ / ㅌ','ㅂ / ㅃ / ㅍ','ㅅ / ㅆ','ㅈ / ㅉ / ㅊ','ㄹ in different positions']
};
// Practical review order, not a TOPIK or CEFR classification. Keep item IDs and saved notes intact.
export const reviewOrder={
 Grammar:['은/는','이/가','있다 / 없다','-아요 / -어요','을/를','에 / 에서','하고 / (이)랑','-지 않다 / 안','-지 못하다 / 못','-았어요 / -었어요','-(으)ㄹ 거예요','-고 싶다','-고','-지만','-아/어서','-(으)면','-고 있다','-(으)ㄹ 수 있다 / 없다','-아/어 보다','-아/어야 하다','-아/어도 되다','-(으)면 안 되다','-기 전에','-(으)ㄴ 후에','-(으)ㄹ 때','-(으)니까','-(으)려고','-(으)면서','-는데 / -(으)ㄴ데','-(으)ㄴ/는 것 같다','-아/어 본 적이 있다','-는 중이다','-기로 하다','-게 되다','-다고 하다','-(으)ㄹ 텐데','-거든요','-잖아요','-더라고요','-아/어 놓다','-아/어 버리다','-는 바람에'],
 Vocabulary:['Numbers and counters','Time and dates','Common action verbs','Daily-life vocabulary','Daily routines','Family and relationships','Food and ingredients','Rooms and household objects','Directions and transport','Shopping and prices','Weather and seasons','Work and study','Cooking verbs','Health and body','Feelings and descriptions','Gaming vocabulary'],
 Conversation:['Introduce myself','Ask someone to repeat or explain','Ask a follow-up question','Asking a follow-up question','Describe what I did yesterday','Explain a plan for tomorrow','Compare two choices','Give a reason for an opinion','Tell a short story'],
 Listening:['Listen for numbers and counters','Recognize sentence endings in a short clip','Compare a clip with its Korean subtitles','Write down one sentence from a video','Identify unfamiliar words in a conversation','Phrases from a Korean stream','Follow a short clip without subtitles'],
 Pronunciation:['ㄱ / ㄲ / ㅋ','ㄷ / ㄸ / ㅌ','ㅂ / ㅃ / ㅍ','ㅅ / ㅆ','ㅈ / ㅉ / ㅊ','받침 — final consonants','연음 — linking sounds','ㄹ in different positions','Sounds I want to check']
};
export function reviewRank(item){const index=reviewOrder[item.category]?.indexOf(item.title)??-1;return index<0?10000:index;}
export function reviewLevel(item){const rank=reviewRank(item);if(rank===10000)return 'Custom';if(item.category==='Grammar')return rank<12?'Basics':rank<28?'Everyday use':'Nuance';return rank<4?'Basics':'Further practice';}
export function sortReview(items){return [...items].sort((a,b)=>reviewRank(a)-reviewRank(b));}
export function prepareKorean(data){
 const next=structuredClone(data),project=next.projects.find(p=>p.id==='korean');
 if(!project||project.checklistSeeded)return next;
 for(const [category,titles] of Object.entries(koreanReview)){
  if(!project.categories.includes(category))project.categories.push(category);
  titles.forEach((title,index)=>{if(!next.items.some(i=>i.projectId==='korean'&&i.title===title)){let id=`korean-review-${category}-${index}`;while(next.items.some(i=>i.id===id))id+='-new';next.items.push({id,projectId:'korean',title,category,status:'curious',notes:'',links:[]});}});
 }
 project.checklistSeeded=true;return validate(next);
}
export function initialData() {
  return {version:1,items:[
    ['ten','-(으)ㄹ 텐데','Grammar'],['baram','-는 바람에','Grammar'],
    ['daily','Daily-life vocabulary','Vocabulary'],['stream','Phrases from a Korean stream','Listening'],
    ['followup','Asking a follow-up question','Conversation'],['sound','Sounds I want to check','Pronunciation']
  ].map(([id,title,category])=>({id,title,category,status:'curious',notes:'',links:[]}))};
}
export function migrate(data){
 if(data?.version===1){const next=structuredClone(data);next.version=2;next.projects=[{id:'korean',name:'Korean',categories:[...categories],archived:false}];next.items.forEach(i=>i.projectId='korean');return validate(next);}return validate(data);
}
export function removeCategory(data,projectId,name){const next=structuredClone(data);const project=next.projects.find(p=>p.id===projectId);project.categories=project.categories.filter(c=>c!==name);next.items.filter(i=>i.projectId===projectId&&i.category===name).forEach(i=>i.category='');return validate(next);}
export function renameCategory(data,projectId,name,replacement){const next=structuredClone(data);const project=next.projects.find(p=>p.id===projectId);project.categories=project.categories.map(c=>c===name?replacement:c);next.items.filter(i=>i.projectId===projectId&&i.category===name).forEach(i=>i.category=replacement);return validate(next);}
export function validate(data) {
  if(data?.version===1)return migrate(data);
  if(!data || data.version!==2 || !Array.isArray(data.projects) || data.projects.length>200 || !Array.isArray(data.items) || data.items.length>3000) throw new Error('Invalid Upheavel backup.');
  const projectIds=new Set();
  for(const p of data.projects){if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||projectIds.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.archived!=='boolean'||!Array.isArray(p.categories)||p.categories.length>100||new Set(p.categories).size!==p.categories.length||p.categories.some(c=>typeof c!=='string'||!c.trim()||c.length>100))throw new Error('Invalid project or duplicate subsection.');projectIds.add(p.id);}
  const ids=new Set();
  for(const item of data.items){
    if(!item || typeof item.id!=='string' || !item.id || item.id.length>100 || ids.has(item.id) || typeof item.title!=='string' || !item.title.trim() || item.title.length>160 || !projectIds.has(item.projectId) || (item.category!==''&&!data.projects.find(p=>p.id===item.projectId).categories.includes(item.category)) || !Object.hasOwn(statuses,item.status) || typeof item.notes!=='string' || item.notes.length>200000 || !Array.isArray(item.links) || item.links.length>100) throw new Error('Invalid learning item.');
    ids.add(item.id);
    for(const link of item.links) if(!link || typeof link.name!=='string' || link.name.length>160 || typeof link.url!=='string' || link.url.length>2000) throw new Error('Invalid resource link.');
  }
  return data;
}
export function updateItem(data,id,fields){const next=structuredClone(data);const item=next.items.find(i=>i.id===id);if(!item)throw new Error('Item not found.');Object.assign(item,fields);return validate(next);}
export function safeUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
