# คู่มือการตั้งค่าระบบและเชื่อมต่อฐานข้อมูล (Configuration Guide)

เอกสารนี้จะอธิบายวิธีการตั้งค่าส่วนต่างๆ เพื่อให้ระบบทำงานได้สมบูรณ์ ทั้ง Google Sheets, MongoDB และ Google Cloud Storage

---

## 1. การตั้งค่า Google Sheets (Metadata Repository)
ระบบนี้ใช้ Google Sheets เป็นฐานข้อมูลหลัก (Master Data Catalog)

### ขั้นตอน:
1.  **สร้าง Google Sheet ใหม่**: ตั้งชื่อว่า `Metadata_Repository_DB` (หรือชื่อที่ท่านต้องการ)
2.  **เปิด Script Editor**: ไปที่ `Extensions` -> `Apps Script`
3.  **วางโค้ด**: ก๊อปปี้โค้ดจากไฟล์ `code.gs` ในโปรเจคนี้ ไปวางทับลงใน Editor ทั้งหมด
4.  **Save & Deploy**:
    *   กดปุ่ม **Deploy** (สีน้ำเงินมุมขวาบน) -> **New deployment**
    *   เลือกประเภทเป็น **Web App**
    *   ช่อง Description: "v1"
    *   ช่อง **Execute as**: เลือก `Me (your_email@gmail.com)`
    *   ช่อง **Who has access**: เลือก `Anyone` (เพื่อให้หน้าเว็บส่งข้อมูลเข้ามาได้)
    *   กด **Deploy**
5.  **Authorize**: กดให้สิทธิ์การเข้าถึง (Review Permissions -> Allow)
6.  **รับ URL**: ท่านจะได้ **Web App URL** (ขึ้นต้นด้วย `https://script.google.com/macros/s/...`)
7.  **นำมาใส่ในโค้ด**:
    *   เปิดไฟล์ `index.html` ในโปรเจค
    *   ค้นหาบรรทัดที่มีคำว่า `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` (ประมาณบรรทัด 1040)
    *   แทนที่ด้วย URL ที่ท่านได้รับมา

---

## 2. การตั้งค่า MongoDB (JSON Store)
ระบบนี้ใช้ MongoDB เพื่อเก็บข้อมูลในรูปแบบ Document (NoSQL) ซึ่งมีความยืดหยุ่นสูง

### กรณีใช้ MongoDB Atlas (Cloud - แนะนำ):
1.  สมัครสมาชิก [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (ฟรี)
2.  สร้าง Cluster ใหม่ (Shared Tier FREE)
3.  สร้าง User Database: ไปที่ `Database Access` -> `Add New Database User` (จด Username/Password ไว้)
4.  อนุญาต Connection: ไปที่ `Network Access` -> `Add IP Address` -> `Allow Access from Anywhere` (0.0.0.0/0) สำหรับทดสอบ
5.  **รับ Connection String**:
    *   กดปุ่ม **Connect** -> **Drivers**
    *   copy โค้ดที่ขึ้นต้นด้วย `mongodb+srv://...`
    *   นำ Password ที่ตั้งไว้มาแทนที่คำว่า `<password>` ใน URL
6.  **บันทึกค่า**: นำ URL นี้ไปใส่ในไฟล์ `.env` ที่ตัวแปร `MONGO_URI`

### กรณีใช้ MongoDB Local (ในเครื่อง):
1.  ติดตั้ง MongoDB Community Server
2.  connection string มักจะเป็น: `mongodb://localhost:27017/metadata_db`
3.  นำไปใส่ในไฟล์ `.env`

---

## 3. การตั้งค่า Google Cloud Storage (Data Lake)
ระบบนี้ใช้ GCS เป็น Data Lake เพื่อเก็บไฟล์ Raw Metadata (JSON)

### ขั้นตอน:
1.  **สร้าง Project**: ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2.  **เปิดใช้ API**: ค้นหา "Cloud Storage API" และกด Enable
3.  **สร้าง Bucket**:
    *   ไปที่เมนู Cloud Storage -> Buckets -> Create
    *   ตั้งชื่อ Bucket (ต้องไม่ซ้ำกับใครในโลก) เช่น `my-org-datalake-2026`
    *   จำชื่อ Bucket นี้ไว้ ใส่ในไฟล์ `.env` ที่ตัวแปร `GCS_BUCKET_NAME`
4.  **สร้าง Service Account Key**:
    *   ไปที่เมนู **IAM & Admin** -> **Service Accounts**
    *   กด **Create Service Account** -> ตั้งชื่อเช่น `metadata-uploader` -> Create
    *   **ให้สิทธิ์ (Role)**: เลือก `Storage Object Admin` (เพื่อให้เขียนไฟล์ได้) -> Continue -> Done
5.  **ดาวน์โหลด Key**:
    *   คลิกที่ Email ของ Service Account ที่เพิ่งสร้าง
    *   ไปที่แท็บ **Keys** -> **Add Key** -> **Create new key** -> เลือก **JSON**
    *   ไฟล์จะถูกดาวน์โหลดลงเครื่องคอมพิวเตอร์ของท่าน
6.  **ติดตั้ง Key**:
    *   นำไฟล์ JSON ที่ได้มาวางไว้ในโฟลเดอร์โปรเจคนี้ (ตั้งชื่อใหม่ให้อ่านง่าย เช่น `gcs-key.json`)
    *   แก้ไขไฟล์ `.env` ที่ตัวแปร `GCS_KEY_FILE_PATH` ให้ตรงกับชื่อไฟล์ (เช่น `./gcs-key.json`)

---

## สรุปไฟล์ .env ที่สมบูรณ์
เมื่อทำครบทุกขั้นตอน ไฟล์ `.env` ของท่านควรมีหน้าตาแบบนี้:

```text
# MongoDB Connection
MONGO_URI=mongodb+srv://admin:mylongpassword@cluster0.mongodb.net/metadata_repo

# Google Cloud Storage Config
GCS_BUCKET_NAME=my-org-datalake-2026
GCS_KEY_FILE_PATH=./gcs-key.json

# Server Port
PORT=3000
```

หวังว่าคู่มือนี้จะช่วยให้ท่านติดตั้งระบบ backend ได้อย่างราบรื่นครับ!
