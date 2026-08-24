import { cp, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const vendor=path.join(root,'vendor');
await rm(vendor,{recursive:true,force:true});await mkdir(vendor,{recursive:true});
async function copyDir(src,dst){if(!existsSync(src))throw new Error(`Missing ${src}. Run npm install first.`);await cp(src,dst,{recursive:true});}
await copyDir(path.join(root,'node_modules','tesseract.js','dist'),path.join(vendor,'tesseract'));
await copyDir(path.join(root,'node_modules','tesseract.js-core'),path.join(vendor,'tesseract-core'));
await mkdir(path.join(vendor,'tessdata'),{recursive:true});
const engRoot=path.join(root,'node_modules','@tesseract.js-data','eng');
async function findTrained(dir){for(const name of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,name.name);if(name.isDirectory()){const found=await findTrained(p);if(found)return found}else if(/^eng\.traineddata(?:\.gz)?$/.test(name.name))return p}return null}
const trained=await findTrained(engRoot);if(!trained)throw new Error('Could not find English traineddata');await copyFile(trained,path.join(vendor,'tessdata',path.basename(trained)));
await mkdir(path.join(vendor,'pdfjs'),{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile(path.join(root,'node_modules','pdfjs-dist','build',name),path.join(vendor,'pdfjs',name));
console.log('Local runtime vendor assets prepared in ./vendor');
