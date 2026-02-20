# คู่มือการติดตั้งและใช้งาน แบบฟอร์ม มรด. 3-1 (Mor Ror Dor 3-1 Metadata Form)

## 1. การใช้งานฟอร์ม (Frontend)
1.  เปิดไฟล์ `index.html` ด้วยเว็บเบราว์เซอร์ (Chrome, Edge, Safari)
2.  สามารถกรอกข้อมูลได้เลยทันที (ใช้งานแบบ Offline ได้สำหรับการ Export JSON/CSV)
3.  หากต้องการบันทึกลง Google Sheets ต้องทำการตั้งค่าในข้อ 2 ก่อน

## 2. การตั้งค่า Google Sheets (Backend)
เพื่อให้ฟอร์มสามารถส่งข้อมูลไปเก็บที่ Google Sheets ของคุณได้ ให้ทำตามขั้นตอนดังนี้:
1.  สร้าง **Google Sheets** ใหม่ (หรือใช้ที่มีอยู่) ที่ [sheets.google.com](https://sheets.google.com)
2.  ไปที่เมนู **ส่วนขยาย (Extensions)** > **Apps Script**
3.  ลบโค้ดเดิมทั้งหมดในหน้าต่าง Editor และ **Copy** โค้ดจากไฟล์ `code.gs` ที่ให้ไป วางแทนที่
4.  กดปุ่ม **Save** (ไอคอนแผ่นดิสก์) ตั้งชื่อโปรเจคว่า `MetadataAPI` (หรืออะไรก็ได้)
5.  กดปุ่ม **Deploy** (มุมขวาบน) > **New deployment**
6.  ตั้งค่าดังนี้:
    - **Select type**: Web app
    - **Description**: v1
    - **Execute as**: **Me** (อีเมลของคุณ)
    - **Who has access**: **Anyone** (ทุกคน) *สำคัญมาก เพื่อให้ฟอร์มส่งข้อมูลเข้าไปได้*
7.  กด **Deploy** 
    - (ถ้ามีการถามสิทธิ์ Authorize Access ให้กด Review permissions > เลือก account > Advanced > Go to (Project Name) (unsafe) > Allow)
8.  คัดลอก **Web app URL** (ที่ขึ้นต้นด้วย `https://script.google.com/macros/s/...`)
9.  กลับมาที่หน้าฟอร์ม `index.html`
10. คลิกปุ่ม **"ตั้งค่าการเชื่อมต่อ Google Sheet"** (มุมขวาบน)
11. วาง URL ลงในช่องว่าง ตัวระบบจะจำค่าไว้ในเครื่องคอมพิวเตอร์นี้

## 3. การ Export ข้อมูล
- **CSV**: สำหรับนำไปเปิดใน Excel (รองรับภาษาไทย)
- **JSON**: สำหรับเก็บเป็นไฟล์สำรอง หรือนำไป import เข้าสู่ระบบอื่นที่รองรับโครงสร้างข้อมูลแบบลำดับชั้น
