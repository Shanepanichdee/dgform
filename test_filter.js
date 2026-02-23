const domainMap = {
    'Agriculture': ['agriculture', 'เกษตร'],
    'Industry': ['industry', 'อุตสาหกรรม'],
    'Economy': ['economy', 'เศรษฐกิจ', 'การคลัง'],
    'Commerce': ['commerce', 'พาณิชย์', 'บริการ'],
    'TourismSports': ['tourism', 'tourismsports', 'ท่องเที่ยว', 'กีฬา'],
    'Education': ['education', 'ศึกษา'],
    'Energy': ['energy', 'พลังงาน'],
    'Environment': ['enviro', 'สิ่งแวดล้อม', 'ทรัพยากร'],
    'Health': ['health', 'สาธารณสุข', 'สุขภาพ'],
    'SecurityLaw': ['security', 'securitylaw', 'มั่นคง', 'กฎหมาย'],
    'Society': ['society', 'สังคม', 'สวัสดิการ'],
    'ScienceTech': ['science', 'sciencetech', 'วิทยาศาสตร์', 'เทคโนโลยี', 'ดิจิทัล'],
    'Transport': ['transport', 'คมนาคม', 'โลจิสติกส์'],
    'Population': ['population', 'ประชากร', 'เคหะ'],
    'CultureReligion': ['culture', 'culturereligion', 'ศาสนา', 'ศิลปะ', 'วัฒนธรรม'],
    'Infrastructure': ['infrastructure', 'โครงสร้างพื้นฐาน'],
    'ForeignAffairs': ['foreign', 'foreignaffairs', 'ต่างประเทศ'],
    'Labor': ['labor', 'แรงงาน'],
    'PublicAdmin': ['admin', 'publicadmin', 'บริหารจัดการ', 'ภาครัฐ'],
    'Other': ['other', 'อื่น']
};

const allDatasets = [
    { title: "Test Doc 1", domain: "Industry" },
    { title: "Test Doc 2", domain: "อุตสาหกรรม" },
    { title: "Test Doc 3", domain: "enviromnment" },
    { title: "Test Doc 4", businessDomain: "enviromnment" },
    { title: "Test Doc 5", keywords: "enviromnment" }, // testing the fallback
];

const testCases = [
    { name: "Test Industry vs 'Industry'", domain: "Industry", query: "" },
    { name: "Test Environment vs 'enviromnment'", domain: "Environment", query: "" }
];

testCases.forEach(tc => {
    const domain = tc.domain;
    const query = tc.query;
    console.log("Testing:", tc.name);
    
    const filtered = allDatasets.filter(item => {
        const allTextContent = Object.values(item).map(v => String(v || '')).join(' ').toLowerCase();

        let matchDomain = false;
        if (domain === 'all') {
            matchDomain = true;
        } else {
            let rawItemDomain = String(item.domain || item.businessDomain || item.businessdomain || item['Business Domain'] || "").toLowerCase();
            if (!rawItemDomain.trim()) rawItemDomain = allTextContent;
            
            const filterKeywords = domainMap[domain] || [domain.toLowerCase()];
            matchDomain = filterKeywords.some(kw => rawItemDomain.includes(kw));
        }

        const matchQuery = !query || allTextContent.includes(query);
        return matchDomain && matchQuery;
    });
    
    console.log("Found:", filtered.length, "datasets");
    console.log(filtered);
    console.log("-----------------------");
});
