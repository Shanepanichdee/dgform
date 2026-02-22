# คู่มือการเพิ่มหน่วยงานใหม่และระบบล็อกอิน (Add New Agency Guide)

คู่มือนี้จัดทำขึ้นเพื่ออธิบายขั้นตอนการเพิ่ม "หน่วยงานใหม่" เข้าสู่ระบบ Data Repository (dgform) 
โดยแต่ละหน่วยงานจะมี **Google Sheet แยกเป็นของตัวเอง** แต่จะใช้ **หน้าล็อกอินร่วมกัน (Single Login Page)** 
ซึ่งควบคุมโดย Google Apps Script ตัวหลัก (ปัจจุบันคือของ `dla2`)

---

## ขั้นตอนที่ 1: เตรียม Google Sheet สำหรับหน่วยงานใหม่
1. เข้ามาที่ Google Drive สร้าว **Google Sheet ใหม่** ตั้งชื่อตามหน่วยงาน เช่น `Data_Repository_DPT`
2. ไปที่เมนู **ส่วนขยาย (Extensions)** -> **Apps Script**
3. คัดลอกโค้ดจากไฟล์ `code.gs` ในเครื่องของคุณ (หรือเปิดโปรเจกต์ `dla2` แล้วคัดลอกมาทั้งหมด) ไปวางทับในเอดิเตอร์
4. กดบันทึก (Save)
5. กดปุ่ม **การทำให้ใช้งานได้ (Deploy)** -> **การทำให้ใช้งานได้รายการใหม่ (New deployment)**
6. เลือกประเภทเป็น **เว็บแอป (Web app)**
7. ตั้งค่าการเข้าถึง:
   - สิทธิ์การเข้าถึง (Who has access): **ทุกคน (Anyone)**
8. กด **ทำให้ใช้งานได้ (Deploy)** และกดยืนยันสิทธิ์อนุญาต (Authorize Access)
9. คัดลอก **URL ของเว็บแอป (Web App URL)** เก็บไว้ (สำคัญมาก)

---

## ขั้นตอนที่ 2: เพิ่มรหัสผ่านในระบบ Authentication หลัก
เนื่องจากระบบล็อกอิน (`login.html`) เรียกใช้ API ตัวเดียวเพื่อความปลอดภัย เราจะต้องไปเพิ่มรหัสผ่านใหม่ที่สคริปต์ของ **ระบบหลัก (dla2)**

1. เปิด Google Apps Script ของ **dla2** ขึ้นมา
2. เลื่อนหาฟังก์ชัน `doPost(e)` ในส่วนของการตรวจสอบรหัสผ่าน (Authentication Check)
3. เพิ่ม **รหัสผ่านใหม่** ลงในตัวแปร `validPasswords`
4. เพิ่มเงื่อนไข `else if` เพื่อจับคู่รหัสผ่าน กับ **รหัสย่อ (Shortcode)** ของหน่วยงาน

**ตัวอย่างการแก้ไข:**
```javascript
// ==========================================
// 1. Authentication Check
// ==========================================
if (data.action === 'login') {
  const usernameInput = (data.username || '').trim().toLowerCase();
  const passwordInput = (data.password || '').trim();
  
  // 1. เพิ่มรหัสผ่านใหม่เข้าไปในอาเรย์นี้ (เช่น 'dpt123')
  const validPasswords = ['admin@123', 'dla123', 'diw123', 'diw2_123', 'dpt123'];
  
  if (usernameInput === 'admin' && validPasswords.includes(passwordInput)) {
    let queryParams = '';
    if (passwordInput === 'dla123') {
       queryParams = '?id=dla2'; 
    } else if (passwordInput === 'diw123') {
       queryParams = '?id=diw';
    } else if (passwordInput === 'diw2_123') {
       queryParams = '?id=diw2';
       
    // 2. เพิ่มเงื่อนไขรหัสย่อของหน่วยงานใหม่
    } else if (passwordInput === 'dpt123') { 
       queryParams = '?id=dpt';
    }

    // ... (โค้ดเดิม) ...
```
5. **กด Deploy -> New deployment** ที่โปรเจกต์ dla2 อีกครั้งเพื่อให้รหัสใหม่ทำงาน

---

## ขั้นตอนที่ 3: จับคู่รหัสย่อกับ URL ในหน้า index.html (หน้าบันทึกข้อมูล)
1. เปิดไฟล์ `index.html` ในโค้ดของคุณ
2. เลื่อนหาฟังก์ชัน `loadConfig()` (ประมาณบรรทัดที่ 860) 
3. เพิ่มข้อมูลหน่วยงานใหม่ลงในตัวแปร `shortcodes` โดยใช้ **รหัสย่อ (Shortcode)** เป็น Key (ต้องตรงกับ Step 2) และนำ Web App URL ที่ได้จาก Step 1 มาใส่ 

**ตัวอย่าง:**
```javascript
function loadConfig() {
    const shortcodes = {
        'dla2': {
            agency: 'กรมการปกครองส่วนท้องถิ่น กระทรวงมหาดไทย',
            url: 'https://script.google.com/macros/s/... (URL ของ dla2) .../exec'
        },
        'diw2': {
            agency: 'กรมโรงงานอุตสาหกรรม กระทรวงอุตสาหกรรม',
            url: 'https://script.google.com/macros/s/... (URL ของ diw2) .../exec'
        },
        // เพิ่มรหัสย่อ 'dpt' ต่อท้าย
        'dpt': {
            agency: 'กรมโยธาธิการและผังเมือง (หน่วยงานใหม่)',
            url: 'https://script.google.com/macros/s/... (URL ของหน่วยงานใหม่ที่ได้จากข้อ 1) .../exec'
        }
    };
    // ... โค้ดที่เหลือเหมือนเดิม ...
```

---

## ขั้นตอนที่ 4: จับคู่รหัสย่อกับ URL ในหน้า catalog.html (หน้าแสดงข้อมูล)
เพื่อให้ระบบสืบค้นข้อมูลสามารถดึงข้อมูลจาก Google Sheet ของหน่วยงานใหม่มาแสดงได้ คุณต้องทำซ้ำขั้นตอนที่ 3 ในไฟล์ `catalog.html`

1. เปิดไฟล์ `catalog.html` 
2. เลื่อนหาฟังก์ชัน `loadConfig()` (ประมาณบรรทัดที่ 279)
3. เพิ่มข้อมูลหน่วยงานใหม่ลักษณะเดียวกัน

**ตัวอย่าง:**
```javascript
function loadConfig() {
    const shortcodes = {
        'dla2': { ... },
        'diw2': { ... },
        // เพิ่มรหัสย่อ 'dpt' ต่อท้าย
        'dpt': {
            agency: 'กรมโยธาธิการและผังเมือง (หน่วยงานใหม่)',
            url: 'https://script.google.com/macros/s/... (URL ของหน่วยงานใหม่ที่ได้จากข้อ 1) .../exec'
        }
    };
    // ... โค้ดที่เหลือเหมือนเดิม ...
```

---

## ขั้นตอนที่ 5: ทดสอบ (Testing)
1. เปิดเบราว์เซอร์ไปที่หน้า `login.html` (Local หรือ GitHub Pages)
2. กรอก Username: `admin` และ Password: `dpt123`
3. สังเกตที่ URL เมื่อล็อกอินสำเร็จ ควรเปลี่ยนเป็น `.../index.html?id=dpt`
4. หน้าเว็บ `index.html` ช่องหน่วยงานผู้ส่งจะกลายเป็นชื่อหน่วยงานใหม่ (อ่านอย่างเดียว) โดยอัตโนมัติ
5. ทดลองกรอกข้อมูล และตรวจสอบใน Google Sheet ของหน่วยงานใหม่ว่าข้อมูลเข้าปกติ

เมื่อทดสอบเรียบร้อย ก็สามารถ Push ขึ้น GitHub ได้ทันที!
