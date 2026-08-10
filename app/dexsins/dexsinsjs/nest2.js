/*<![CDATA[*/
(function(){
"use strict";

function injectStyles(){
if(document.getElementById("ns-styles")) return;

const style=document.createElement("style");
style.id="ns-styles";
style.textContent=`
.nested-section.ns-level-1{background-color:rgb(27,27,27)!important;}
.nested-section.ns-level-2{background-color:rgb(30,30,30)!important;}
.nested-section.ns-level-3{background-color:rgb(35,35,35)!important;}
.nested-section.ns-level-4{background-color:rgb(40,40,40)!important;}
.nested-section.ns-level-5{background-color:rgb(43,43,43)!important;}
.nested-section.ns-level-6{background-color:rgb(46,46,46)!important;}

.nested-section{
display:block!important;
padding:13px!important;
margin:13px 0!important;
border:1px solid #404040!important;
border-radius:25px!important;
box-sizing:border-box!important;
width:100%!important;
max-width:100%!important;
color:#cacaca!important;
text-align:left!important;
overflow-x:hidden!important;
overflow-wrap:break-word!important;
word-wrap:break-word!important;
}

.nested-section *{
max-width:100%;
box-sizing:border-box;
}

.ns-heading{
margin:0 0 10px!important;
color:#fff!important;
font-family:dexy,sans-serif!important;
overflow-wrap:break-word!important;
word-break:break-word!important;
hyphens:auto!important;
white-space:normal!important;
}
`;
document.head.appendChild(style);
}

function applyNestedSections(){
injectStyles();

const post=document.querySelector(".post-body");
if(!post||post.getAttribute("data-applied")) return;

const flatNodes=[];

function flatten(node){
Array.from(node.childNodes).forEach(child=>{
const isHeading=child.nodeType===1&&/^H[1-6]$/.test(child.tagName);

// Treat any imported widget (e.g. heart_by_vkd) as an atomic leaf: keep the
// element and its attributes intact instead of descending into it and
// discarding the wrapper. Without this, empty/self-contained widget
// elements are destroyed when the post body is rebuilt below.
const isImport=child.nodeType===1&&child.hasAttribute&&child.hasAttribute("data-import");

if(
child.nodeType===1 &&
(child.tagName==="DIV"||child.tagName==="SPAN") &&
!isHeading &&
!isImport &&
!child.className.includes("nested-section") &&
!child.className.includes("separator")
){
flatten(child);
}else{
flatNodes.push(child);
}
});
}

flatten(post);
if(!flatNodes.length) return;

const fragment=document.createDocumentFragment();
let stack=[{element:fragment,level:0}];

flatNodes.forEach(node=>{
if(node.nodeType===3&&!node.textContent.trim()&&stack.length===1) return;

if(node.nodeType===1&&node.tagName==="ISOLATE"){
fragment.appendChild(node);
return;
}

let level=-1;
if(node.nodeType===1&&/^H[1-6]$/.test(node.tagName)){
level=parseInt(node.tagName.substring(1));
}

if(level>0){
while(stack.length>1&&stack[stack.length-1].level>=level){
stack.pop();
}

const wrapper=document.createElement("div");
wrapper.className=`nested-section ns-level-${level}`;

node.classList.add("ns-heading");

["fontSize","margin","color","fontFamily","whiteSpace"]
.forEach(prop=>node.style.removeProperty(prop));

stack[stack.length-1].element.appendChild(wrapper);
wrapper.appendChild(node);

stack.push({element:wrapper,level});
}else{
stack[stack.length-1].element.appendChild(node);
}
});

post.innerHTML="";
post.appendChild(fragment);
post.setAttribute("data-applied","true");
}

if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",applyNestedSections);
}else{
applyNestedSections();
}

window.addEventListener("load",()=>setTimeout(applyNestedSections,200));

new MutationObserver(applyNestedSections).observe(document.body,{
childList:true,
subtree:true
});

})();
/*]]>*/
