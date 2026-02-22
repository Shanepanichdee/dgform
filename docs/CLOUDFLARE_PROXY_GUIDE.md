# คู่มือการซ่อน URL (API Proxy) ด้วย Cloudflare Workers

การฝัง URL ของ Google Apps Script (เช่น `script.google.com/...`) ลงในโค้ด HTML โดยตรง จะทำให้ผู้ใช้งานสามารถมองเห็น URL จริงได้จากการดู Source Code (F12) 
เพื่อความปลอดภัยและความเป็นมืออาชีพ เราจะใช้ **Cloudflare Workers** (ฟรี) ทำหน้าที่เป็น "คนกลาง" (Proxy) ในการรับ-ส่งข้อมูลแทน

ผู้ใช้จะเห็นแค่ URL ของคุณ (เช่น `https://api.shane.workers.dev`) โดยไม่รู้เลยว่าเบื้องหลังมันส่งข้อมูลไปที่ Google Sheet ไหน

---

## ขั้นตอนที่ 1: สมัครและสร้าง Cloudflare Worker (ฟรี)
1. ไปที่เว็บไซต์ [Cloudflare Dashboard](https://dash.cloudflare.com/) และสมัครสมาชิก/เข้าสู่ระบบ
2. ที่เมนูด้านซ้าย เลือกคำว่า **"Workers & Pages"** -> กดปุ่ม **"Create Application"**
3. เลือกแท็บ **"Workers"** และคลิกหน้าต่าง **"Create Worker"**
4. ตั้งชื่อ Worker ของคุณ (ตัวอย่างเช่น: `dgform-proxy`)
5. กดปุ่ม **"Deploy"** (ระบบจะสร้าง Worker เริ่มต้นแบบง่ายๆ ให้คุณก่อน 1 ตัว)

---

## ขั้นตอนที่ 2: แก้ไขโค้ดใน Worker ให้เป็น Proxy ลับของเรา
เมื่อ Deploy เสร็จแล้ว คุณจะมาเจอกับหน้ารายละเอียดของ Worker 
1. กดที่ปุ่ม **"Edit Code"** (ขวาบน)
2. ลบโค้ดทั้งหมดที่อยู่ในหน้าจอและ **คัดลอกโค้ดด้านล่างนี้** ไปวางทับแทน:

```javascript
/**
 * Cloudflare Worker API Proxy (Multi-Agency)
 * ซ่อน URL ของ Google Apps Script ไม่ให้ Client-Side เห็น
 */

// เครือข่าย URL ของหน่วยงานที่ต้องการซ่อน (เก็บเป็น Object/Dictionary)
const AGENCY_URLS = {
    "dla": "https://script.google.com/macros/s/AKfycbwdfCsonERY5XjkPUJypgGCOKW6NNKM5mnDUE0yB8bXv2X05g9anHVNxlYGdO0nV1MnuQ/exec",
    "dla2": "https://script.google.com/macros/s/AKfycbzKnB6GjUD9AjHf3KsULx7jtwYCj7DqxDTUDgP9U9I9zqq97TOPLp2y1OKUW6B63EaT/exec",
    "diw": "https://script.google.com/macros/s/AKfycbxv0FI96eLnQ5pVFX7rOB67k9rIMYh7C8ZiPFZp0hK9sAFHhvzNnSCCW8hWZ_lzgCXCOw/exec",
    "diw2": "https://script.google.com/macros/s/AKfycbyWe7xf8ARJif7omiquFvDX71EKXpfItM-21gUHI49zNiFr4TYGFoz2eAfSseLLu3FO/exec"
};

// URL เริ่มต้น (เมื่อไม่มีการระบุหน่วยงาน ให้เลี้ยวมาที่ตัวหลัก)
const DEFAULT_URL = AGENCY_URLS["dla2"];

export default {
    async fetch(request, env, ctx) {
        
        // อนุญาตให้หน้าเว็บของ GitHub Pages เรียกใช้งาน Worker นี้ได้ (แก้ CORS)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };
        
        // จัดการกับ Preflight Request (OPTIONS)
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // โคลน Request เดิมที่ส่งมาจากหน้าเว็บ
            const url = new URL(request.url);
            
            // อ่านค่าพารามิเตอร์ `?id=` จาก URL ที่ส่งเข้ามา เช่น `https://worker...?id=diw2`
            const agencyId = url.searchParams.get("id");
            
            // เลือกว่าจะส่งข้อมูลให้ URL อันไหนดี
            // (ถ้ามีไอดี และไอดีนั้นมีในระบบ ให้ใช้ของหน่วยงานนั้น ถ้าไม่มีให้ใช้ของหลัก / dla2)
            const targetUrl = (agencyId && AGENCY_URLS[agencyId]) ? AGENCY_URLS[agencyId] : DEFAULT_URL;
            
            // สร้าง Request ใหม่ วิ่งไปหา Google Apps Script แบบลับๆ
            // โดยยังคงส่ง Parameter และเนื้อหา (body) ตามเดิมทั้งหมด
            const modifiedRequest = new Request(targetUrl + url.search, {
                method: request.method,
                headers: request.headers,
                body: request.method === 'POST' ? await request.arrayBuffer() : null,
                redirect: 'follow'
            });

            // รอการตอบกลับจาก Google
            let response = await fetch(modifiedRequest);
            let responseBody = await response.text(); // อ่านแบบ text เพื่อรักษา Format ภาษาไทย
            
            // คัดลอก Headers เดิมจาก Google (ที่มีข้อมูล charset=utf-8) แล้วเสริมด้วย CORS ของเรา
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Access-Control-Allow-Origin", "*");
            newHeaders.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
            newHeaders.set("Access-Control-Allow-Headers", "Content-Type");
            
            // ส่งข้อมูลจริงกลับไปยังผู้ใช้
            return new Response(responseBody, {
                status: response.status,
                headers: newHeaders
            });

        } catch (error) {
            return new Response(JSON.stringify({ result: 'error', message: 'Proxy Failed' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
};
```
3. กดปุ่ม **"Deploy"** (มุมขวาบน) อีกครั้งเพื่อบันทึกและเปิดใช้งาน
4. คุณจะได้ URL ลับของคุณมา (เช่น `https://dgform-proxy.yourname.workers.dev`) ให้คัดลอกเก็บไว้ครับ 

*(หมายเหตุ: หากคุณมี `diw2` , `dpt` ที่ URL ของ Sheet ต่างกัน คุณสามารถสร้าง Worker แยกตามจำนวนหน่วยงาน หรือพัฒนาโค้ดให้อ่าน `?id=diw` แล้วสลับ URL ภายใน Worker ตัวเดียวก็ได้ครับ)*

---

## ขั้นตอนที่ 3: นำ URL Proxy ไปแทนที่ในเว็บ HTML บนเครื่องคุณ
เมื่อคุณได้ URL ของ Worker มาแล้ว 
1. เปิดไฟล์ `login.html` (และ `login_search.html`, `login_register.html`)
2. เปลี่ยนบรรทัด `const AUTH_URL = 'https://script....'` ให้กลายเป็น:
```javascript
const AUTH_URL = 'https://dgform-proxy.yourname.workers.dev'; 
```
3. บันทึกไฟล์ 
4. ทำพฤติกรรมเดียวกันนี้กับไฟล์ `index.html` และ `catalog.html` (ตรงฟังก์ชัน `loadConfig()`) โดยเอา URL ของ Cloudflare ไปใส่แทนลิงก์ Google สีฟ้าๆ ใน Code 

เพียงเท่านี้ หน้าที่ส่งข้อมูลไปหา Google จะเป็นของ Cloudflare (เซิร์ฟเวอร์หลังบ้าน) ทำให้เบราว์เซอร์จะไม่รู้เลยว่าปลายทางที่แท้จริงคือ Google Sheet ไหนครับ ปลอดภัยร้อยเปอร์เซ็นต์!
