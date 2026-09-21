import { parseResultsText } from './matcher-core.js';
import { pdfTextItemsToLines, readAllPdfPages } from './document-core.js';

const root=new URL('./',import.meta.url);
let runtime;
export function validateUpload(file,kind='results') {
  if(!file||file.size===0)throw new Error('Choose a non-empty file.');
  if(file.size>12*1024*1024)throw new Error('Choose a file smaller than 12 MB.');
  const allowed=kind==='photo'?/^image\/(jpeg|png|webp)$/i:/^(image\/(jpeg|png|webp)|application\/pdf|text\/(plain|csv))$/i;
  if(!allowed.test(file.type))throw new Error(kind==='photo'?'Use a JPG, PNG or WebP photograph.':'Use a JPG, PNG, WebP, PDF, plain text or CSV file.');
  return true;
}
async function tesseract() {
  if(window.Tesseract)return window.Tesseract;
  runtime??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/tesseract/tesseract.min.js',root).href;script.onload=()=>resolve(window.Tesseract);script.onerror=()=>{runtime=null;reject(new Error('Local OCR could not load. Enter your results manually.'));};document.head.append(script);});
  return runtime;
}
export async function recogniseImage(source,onProgress=()=>{}) {
  onProgress('Loading local OCR…');const T=await tesseract();
  const worker=await T.createWorker('eng',1,{workerPath:new URL('vendor/tesseract/worker.min.js',root).href,corePath:new URL('vendor/tesseract-core',root).href,langPath:new URL('vendor/tessdata',root).href,logger:m=>onProgress(`Reading image: ${m.status} ${Math.round((m.progress||0)*100)}%`)});
  let timer;
  try{return (await Promise.race([worker.recognize(source),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OCR timed out. Try a clearer image or enter results manually.')),90000);})])).data.text||'';}
  finally{clearTimeout(timer);await worker.terminate();}
}
export async function readResultsFile(file,onProgress=()=>{}) {
  validateUpload(file);let text='';
  if(file.type.startsWith('text/'))text=await file.text();
  else if(file.type==='application/pdf') {
    const pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.mjs',root).href;
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    try {
      if(pdf.numPages>10)throw new Error('Use a results PDF with no more than ten pages.');
      const pages=await readAllPdfPages(pdf,async(page,n,total)=>{
        onProgress(`Reading page ${n} of ${total}…`);const content=pdfTextItemsToLines((await page.getTextContent()).items);
        if(parseResultsText(content).length)return content;
        const viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        return recogniseImage(canvas,onProgress);
      });text=pages.join('\n');
    }finally{await pdf.destroy();}
  }else text=await recogniseImage(file,onProgress);
  return {text,rows:parseResultsText(text).map(row=>({...row,qualification:'GCSE'}))};
}
