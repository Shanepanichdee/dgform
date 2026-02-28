const fs = require('fs');

const mockData = {
    result: 'success',
    data: {
        datasetId: '12345',
        title: 'ระบบทะเบียนโรงงาน',
        source: 'ฐานข้อมูลกพร. -> ระบบขึ้นทะเบียน -> ไฟล์ Excel',
        dictionary: [
            { variable: 'OWN_NAME', description: 'ชื่อเจ้าของ', type: 'String' }
        ],
        glossary: []
    }
};

function testLogic(fullDataResult) {
    let semanticRules = [];
    let businessRules = [];
    let complianceRules = [];

    if (fullDataResult.result === 'success' && fullDataResult.data) {
        const fullData = fullDataResult.data;

        // --- RENDER DATA LINEAGE ---
        let lineageHtml = '';
        const sourceText = String(fullData.source || '');
        if (sourceText.includes('->')) {
            try {
                const nodes = sourceText.split('->').map(s => s.trim()).filter(s => s !== '');
                const targetNode = fullData.title || 'Current Dataset';

                if (!nodes[nodes.length - 1].toLowerCase().includes(targetNode.toLowerCase())) {
                    nodes.push(targetNode);
                }

                let mermaidCode = 'graph LR;\\n';
                for (let i = 0; i < nodes.length; i++) {
                    let safeText = nodes[i].replace(/[\[\]"']/g, '');
                    if (i === nodes.length - 1) {
                        mermaidCode += `  Node${i}["📌 ${safeText}"]:::targetClass;\\n`;
                    } else {
                        mermaidCode += `  Node${i}["${safeText}"];\\n`;
                    }

                    if (i < nodes.length - 1) {
                        mermaidCode += `  Node${i} --> Node${i + 1};\\n`;
                    }
                }
                mermaidCode += `  classDef targetClass fill:#e3f2fd,stroke:#0d6efd,stroke-width:2px;`;

                lineageHtml = `<div class="mermaid">${mermaidCode}</div>`;
                console.log("Lineage parsed successfully.");
            } catch (mermaidErr) {
                console.error('Mermaid render error:', mermaidErr);
            }
        }

        // Render Data Dictionary if exists
        if (fullData.dictionary && fullData.dictionary.length > 0) {
            fullData.dictionary.forEach(dict => {
                const varName = String(dict.variable || '').toLowerCase().trim();
                const piiVarNames = [
                    'name', 'fname', 'lname', 'first_name', 'last_name', 'firstname', 'lastname',
                    'idcard', 'id_card', 'cid', 'phone', 'telephone', 'mobile', 'email', 'address',
                    'birthdate', 'dob', 'age', 'gender', 'sex', 'nationality', 'passport',
                    'own_name', 'oaddress', 'omoo', 'osoi', 'oroad', 'otum', 'oamp', 'oprov',
                    'site_name', 'saddress', 'smoo', 'ssoi', 'sroad', 'stumname', 'sampname', 'sprovname'
                ];
                const spiiVarNames = ['religion', 'blood_type', 'blood', 'disease', 'password', 'fingerprint', 'biometric', 'salary', 'income'];

                const piiThaiPhrases = [
                    'ชื่อ-นามสกุล', 'ชื่อนามสกุล', 'ชื่อและนามสกุล', 'คำนำหน้าชื่อ',
                    'บัตรประจำตัวประชาชน', 'เลขที่บัตรประชาชน', 'เบอร์โทรศัพท์ติดต่อ', 'ที่อยู่อีเมล',
                    'ที่อยู่จัดส่ง', 'วันเดือนปีเกิด', 'หมายเลขโทรศัพท์', 'ข้อมูลส่วนบุคคล',
                    'ผู้ถือกรรมสิทธิ์', 'สถานที่ตั้ง'
                ];
                const spiiThaiPhrases = ['ศาสนาที่นับถือ', 'กรุ๊ปเลือด', 'ประวัติอาชญากรรม', 'รหัสผ่านเข้าสู่ระบบ', 'ลายนิ้วมือ', 'ข้อมูลอ่อนไหว'];
                const idCardRegex = /13\s*หลัก/i;

                let combinedTextForScan = '';
                for (let key in dict) {
                    if (typeof dict[key] === 'string') {
                        combinedTextForScan += dict[key] + ' ';
                    }
                }

                const lowerText = combinedTextForScan.toLowerCase();
                const explicitPiiVal = String(dict.hasPII || dict.haspii || dict.HasPII || dict.pii || '').toLowerCase().trim();
                let privacyLevel = null;

                if (spiiVarNames.includes(varName) || spiiThaiPhrases.some(phrase => lowerText.includes(phrase)) || lowerText.includes('sensitive data')) {
                    privacyLevel = 'SPII';
                } else if (explicitPiiVal === 'yes' || explicitPiiVal === 'y' || piiVarNames.includes(varName) || piiThaiPhrases.some(phrase => lowerText.includes(phrase)) || idCardRegex.test(lowerText) || lowerText.includes('pii data') || lowerText.includes('personal data')) {
                    privacyLevel = 'PII';
                }

                let privacyBadge = '';
                if (privacyLevel === 'SPII') {
                    privacyBadge = `<span class="badge bg-danger ms-2 shadow-sm" title="Sensitive Personal Data" style="font-size: 0.75rem;"><i class="bi bi-exclamation-triangle-fill"></i> SPII</span>`;
                    complianceRules.push({ field: dict.variable || 'Unknown Field', rule: `<span class="text-danger fw-bold">[Auto-Detected] ข้อมูลอ่อนไหว (Sensitive PII) - ต้องเข้ารหัสและจำกัดสิทธิ์การเข้าถึงขั้นสูงสุด!</span>` });
                } else if (privacyLevel === 'PII') {
                    privacyBadge = `<span class="badge bg-warning text-dark ms-2 shadow-sm" title="Personal Data" style="font-size: 0.75rem;"><i class="bi bi-person-bounding-box"></i> PII</span>`;
                    complianceRules.push({ field: dict.variable || 'Unknown Field', rule: `<span class="text-warning fw-bold" style="color: #fd7e14 !important;">[Auto-Detected] ข้อมูลส่วนบุคคล (PII) - ต้องจัดเก็บและใช้งานตาม พรบ.คุ้มครองข้อมูลส่วนบุคคล</span>` });
                }
            });
            console.log("Dictionary parsed successfully.");
        }

        // --- RENDER DQ SCORECARD ---
        if (semanticRules.length > 0 || businessRules.length > 0 || complianceRules.length > 0) {
            function renderRuleList(rules, icon, textColor) {
                if (rules.length === 0) return `<p class="text-muted small fst-italic mb-0">- ไม่มีข้อกำหนด -</p>`;
                return `<ul class="list-unstyled mb-0 small">` + rules.map(r => `<li class="mb-2"><i class="bi ${icon} ${textColor} me-2"></i><strong>${r.field}:</strong> ${r.rule}</li>`).join('') + `</ul>`;
            }
            console.log("DQ Scorecard parsed successfully. Compliance Rules count: ", complianceRules.length);
        }

    } else {
        console.log("Error logic path hit");
    }
}

try {
    testLogic(mockData);
    console.log("All logic executed without throwing upper errors!");
} catch (e) {
    console.error("CRITICAL ERROR CAUGHT:");
    console.error(e);
}
