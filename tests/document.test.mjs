import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfTextItemsToLines, readAllPdfPages } from '../document-core.js';

test('reconstructs PDF table rows instead of flattening all text',()=>{
 const text=pdfTextItemsToLines([
   {str:'5',transform:[1,0,0,1,300,700]},
   {str:'Mathematics',transform:[1,0,0,1,50,700]},
   {str:'English Language',transform:[1,0,0,1,50,680]},
   {str:'4',transform:[1,0,0,1,300,680]}
 ]);
 assert.equal(text,'Mathematics 5\nEnglish Language 4');
});

test('reads every page of a multi-page PDF in order',async()=>{
 const visited=[];
 const cleaned=[];
 const pdf={
   numPages:7,
   async getPage(pageNumber){
     return {pageNumber,cleanup(){cleaned.push(pageNumber)}};
   }
 };
 const pages=await readAllPdfPages(pdf,async page=>{
   visited.push(page.pageNumber);
   return `page-${page.pageNumber}`;
 });
 assert.deepEqual(visited,[1,2,3,4,5,6,7]);
 assert.deepEqual(cleaned,visited);
 assert.deepEqual(pages,visited.map(number=>`page-${number}`));
});
