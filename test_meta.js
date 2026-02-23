const stdMap = {
    submitteragency: 'submitterAgency', agency: 'submitterAgency',
    domain: 'businessDomain', businessdomain: 'businessDomain',
    title: 'title', name: 'title',
    description: 'description', desc: 'description',
    objective: 'objective',
    keywords: 'keywordsInput', keyword: 'keywordsInput',
    topiccategory: 'topicCategory', topic: 'topicCategory',
    govdatacategory: 'govDataCategory', govcat: 'govDataCategory',
    classification: 'classification', class: 'classification',
    datasettype: 'datasetType', type: 'datasetType',
    functionalrole: 'functionalRole', role: 'functionalRole',
    datastructure: 'dataStructure', structure: 'dataStructure',
    license: 'license',
    owner: 'owner',
    maintainer: 'maintainer',
    email: 'email', contact: 'email',
    source: 'source',
    fileformat: 'fileFormat', format: 'fileFormat',
    updatefrequnit: 'updateFreqUnit', freq: 'updateFreqUnit',
    updatefreqvalue: 'updateFreqValue', freqval: 'updateFreqValue',
    geocoverage: 'geoCoverage', geo: 'geoCoverage',
    accessurl: 'accessUrl', url: 'accessUrl',
    createddate: 'createdDate', created: 'createdDate',
    lastmodifieddate: 'lastModifiedDate', modified: 'lastModifiedDate',
    accessiblecondition: 'accessibleCondition', condition: 'accessibleCondition',
    sponsor: 'sponsor',
    unitofanalysis: 'unitOfAnalysis', unit: 'unitOfAnalysis',
    language: 'language', lang: 'language'
};

const dataObj = {"datasetId":"fc8f5c26-8cb7-4a70-a1fb-7077c5a8723f","submitterAgency":"กรมส่งเสริมการปกครองท้องถิ่น","timestamp":"2026-02-21T15:57:49.000Z","domain":"สังคม (Social Focus)","title":"ข้อมูลจำนวนประชากรและการลงทะเบียนผู้สูงอายุในระดับท้องถิ่น","description":"ชุดข้อมูลแสดงจำนวนประชากรที่เข้าเกณฑ์และได้รับเบี้ยยังชีพผู้สูงอายุ แยกตามรายตำบลและเทศบาลทั่วประเทศ ประจำปีงบประมาณ 2568","objective":"เพื่อใช้ในการวางแผนจัดสรรงบประมาณอุดหนุนเบี้ยยังชีพผู้สูงอายุให้แก่องค์กรปกครองส่วนท้องถิ่น (อปท.)","keywords":"ผู้สูงอายุ, เบี้ยยังชีพ, อปท, กระทรวงมหาดไทย, สังคมสงเคราะห์","topicCategory":"2.13 สังคมและสวัสดิการ","govDataCategory":"1.2 Internal","classification":"Private","datasetType":"3.1 ตารางสถิติ (Statistical Data)","functionalRole":"4.4 Shared","dataStructure":"5.1 Structured","license":"Open Data Commons Open Database License (ODbL)","owner":"กองพัฒนาและส่งเสริมการบริหารงานท้องถิ่น","maintainer":"ศูนย์บริหารข้อมูลท้องถิ่น","email":"data_center@dla.go.th","source":"ระบบสารสนเทศเบี้ยยังชีพ อปท.","fileFormat":"CSV","updateFreqUnit":"รายปี","updateFreqValue":1,"geoCoverage":"ระดับประเทศ (National)","accessUrl":"https://data.dla.go.th/elderly-2568","createdDate":"2024-09-30T17:00:00.000Z","lastModifiedDate":"2024-10-14T17:00:00.000Z","accessibleCondition":"สามารถดาวน์โหลดไปใช้งานได้ทันทีโดยไม่ต้องขออนุญาต แต่ต้องอ้างอิงแหล่งที่มา","sponsor":"กระทรวงการพัฒนาสังคมและความมั่นคงของมนุษย์ (พม.)","unitOfAnalysis":"คน/ตำบล","language":"th","datasetName":"","System_Reference_ID":"DLA-SS-2025-001","Data_Steward_Name":"นายสมชาย ท้องถิ่นไทย","Target_API_Endpoint":"https://api.dla.go.th/v1/elderly"};

const unknownKeys = new Set();
const foundElements = [];

Object.keys(dataObj).forEach(key => {
    const normalizedKey = key.toLowerCase().trim();
    const targetId = stdMap[normalizedKey];

    if (targetId) {
        foundElements.push({key, targetId, value: dataObj[key]});
    } else {
        if (key && !key.toLowerCase().includes('dictionary') && !key.toLowerCase().includes('glossary')) {
            unknownKeys.add(key.trim());
        }
    }
});

console.log("Found Elements to populate:", foundElements.length);
console.log("Unknown Keys (Custom Fields):", Array.from(unknownKeys));

