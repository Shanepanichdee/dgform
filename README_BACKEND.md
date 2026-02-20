# คู่มือการติดตั้งและใช้งาน Backend Server (Node.js)

โปรเจคนี้มีการเพิ่ม Backend Server (Node.js) เพื่อรองรับการบันทึกข้อมูลลงฐานข้อมูล MongoDB และ Google Cloud Storage (Data Lake) ตามที่ได้วางแผนไว้

## สิ่งที่ต้องเตรียม (Prerequisites)
1.  **Node.js**: ต้องติดตั้งในเครื่อง (ดาวน์โหลดได้ที่ [nodejs.org](https://nodejs.org/))
2.  **MongoDB**: ต้องมี Connection String (ใช้ MongoDB Atlas หรือ Local Installation ก็ได้)
3.  **Google Cloud Storage**: ต้องมี Service Account Key (JSON file) และ Bucket ที่สร้างไว้แล้ว

## ขั้นตอนการติดตั้ง (Installation)

1.  **เปิด Terminal** แล้วเข้าไปที่โฟลเดอร์ของโปรเจค
    ```bash
    cd /path/to/project/folder
    ```

2.  **ติดตั้ง Dependency**
    ```bash
    npm install
    ```
    (ระบบจะอ่านไฟล์ `package.json` และติดตั้ง `express`, `mongoose`, `cors`, `dotenv`, `@google-cloud/storage` ให้เอง)

3.  **ตั้งค่า Environment Variables**
    *   ให้Copyไฟล์ `.env.example` เป็น `.env`
    *   แก้ไขไฟล์ `.env` ใส่ค่าของท่านเอง:
        ```text
        MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/my_data_catalog
        GCS_BUCKET_NAME=my-datalake-bucket
        GCS_KEY_FILE_PATH=./path-to-your-service-account-key.json
        PORT=3000
        ```

## วิธีการรัน Server (Usage)

1.  **Start Server**
    ```bash
    npm start
    ```
    หากสำเร็จ จะขึ้นข้อความ:
    > Server running on http://localhost:3000
    > ✅ Connected to MongoDB (ถ้าตั้งค่าถูกต้อง)
    > ✅ GCS Client initialized... (ถ้าตั้งค่าถูกต้อง)

2.  **การใช้งานบนหน้าเว็บ**
    *   เปิดไฟล์ `index.html`
    *   ที่ส่วนล่างสุด เลือก **Destination** เป็น `MongoDB` หรือ `GCS`
    *   กดปุ่ม **บันทึกข้อมูล**
    *   ระบบจะส่งข้อมูลไปที่ Server Localhost ของท่านทันที

## โครงสร้างข้อมูลที่จัดเก็บ

*   **MongoDB**: เก็บเป็น JSON Document ใน Collection `metadata` พร้อม Timestamp
*   **GCS**: เก็บเป็นไฟล์ JSON ใน path `raw/{domain}/{title}_{timestamp}.json` (เหมาะสำหรับทำ Data Lake)
