const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or Service Role Key in environment!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const billers = [
  // ==========================================
  // 1. MOBILE PREPAID
  // ==========================================
  {
    biller_id: 'AIRT00000PRE',
    biller_name: 'Airtel Prepaid',
    category: 'Mobile Prepaid',
    metadata: {
      billerId: 'AIRT00000PRE',
      billerName: 'Airtel Prepaid',
      category: 'Mobile Prepaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'JIO000000PRE',
    biller_name: 'Jio Prepaid',
    category: 'Mobile Prepaid',
    metadata: {
      billerId: 'JIO000000PRE',
      billerName: 'Jio Prepaid',
      category: 'Mobile Prepaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'VODA00000PRE',
    biller_name: 'Vi Prepaid',
    category: 'Mobile Prepaid',
    metadata: {
      billerId: 'VODA00000PRE',
      billerName: 'Vi Prepaid',
      category: 'Mobile Prepaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'BSNL00000PRE',
    biller_name: 'BSNL Prepaid',
    category: 'Mobile Prepaid',
    metadata: {
      billerId: 'BSNL00000PRE',
      billerName: 'BSNL Prepaid',
      category: 'Mobile Prepaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 2. MOBILE POSTPAID
  // ==========================================
  {
    biller_id: 'AIRT00000POS',
    biller_name: 'Airtel Postpaid',
    category: 'Mobile Postpaid',
    metadata: {
      billerId: 'AIRT00000POS',
      billerName: 'Airtel Postpaid',
      category: 'Mobile Postpaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'JIO000000POS',
    biller_name: 'Jio Postpaid',
    category: 'Mobile Postpaid',
    metadata: {
      billerId: 'JIO000000POS',
      billerName: 'Jio Postpaid',
      category: 'Mobile Postpaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'VODA00000POS',
    biller_name: 'Vi Postpaid',
    category: 'Mobile Postpaid',
    metadata: {
      billerId: 'VODA00000POS',
      billerName: 'Vi Postpaid',
      category: 'Mobile Postpaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'BSNL00000POS',
    biller_name: 'BSNL Postpaid',
    category: 'Mobile Postpaid',
    metadata: {
      billerId: 'BSNL00000POS',
      billerName: 'BSNL Postpaid',
      category: 'Mobile Postpaid',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 3. CREDIT CARD
  // ==========================================
  {
    biller_id: 'SBIC000000CC',
    biller_name: 'SBI Card',
    category: 'Credit Card',
    metadata: {
      billerId: 'SBIC000000CC',
      billerName: 'SBI Card',
      category: 'Credit Card',
      inputParams: {
        input: [
          { paramName: 'Credit Card Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'HDFC000000CC',
    biller_name: 'HDFC Bank Credit Card',
    category: 'Credit Card',
    metadata: {
      billerId: 'HDFC000000CC',
      billerName: 'HDFC Bank Credit Card',
      category: 'Credit Card',
      inputParams: {
        input: [
          { paramName: 'Credit Card Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'ICIC000000CC',
    biller_name: 'ICICI Bank Credit Card',
    category: 'Credit Card',
    metadata: {
      billerId: 'ICIC000000CC',
      billerName: 'ICICI Bank Credit Card',
      category: 'Credit Card',
      inputParams: {
        input: [
          { paramName: 'Credit Card Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'AXIS000000CC',
    biller_name: 'Axis Bank Credit Card',
    category: 'Credit Card',
    metadata: {
      billerId: 'AXIS000000CC',
      billerName: 'Axis Bank Credit Card',
      category: 'Credit Card',
      inputParams: {
        input: [
          { paramName: 'Credit Card Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },

  // ==========================================
  // 4. ELECTRICITY
  // ==========================================
  {
    biller_id: 'TORR00000ELE',
    biller_name: 'Torrent Power - Ahmedabad',
    category: 'Electricity',
    metadata: {
      billerId: 'TORR00000ELE',
      billerName: 'Torrent Power - Ahmedabad',
      category: 'Electricity',
      inputParams: {
        input: [{ paramName: 'Service Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'TORR00001ELE',
    biller_name: 'Torrent Power - Surat',
    category: 'Electricity',
    metadata: {
      billerId: 'TORR00001ELE',
      billerName: 'Torrent Power - Surat',
      category: 'Electricity',
      inputParams: {
        input: [{ paramName: 'Service Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'ADAN00000ELE',
    biller_name: 'Adani Electricity Mumbai',
    category: 'Electricity',
    metadata: {
      billerId: 'ADAN00000ELE',
      billerName: 'Adani Electricity Mumbai',
      category: 'Electricity',
      inputParams: {
        input: [{ paramName: 'Consumer Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'TATA00000ELE',
    biller_name: 'Tata Power - Mumbai',
    category: 'Electricity',
    metadata: {
      billerId: 'TATA00000ELE',
      billerName: 'Tata Power - Mumbai',
      category: 'Electricity',
      inputParams: {
        input: [{ paramName: 'Consumer Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'MAHA00000TE501',
    biller_name: 'MAHADISCOM (UAT Test)',
    category: 'Electricity',
    metadata: {
      billerId: 'MAHA00000TE501',
      billerName: 'MAHADISCOM (UAT Test)',
      category: 'Electricity',
      inputParams: {
        input: [{ paramName: 'Consumer Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'DELECTRICITY01',
    biller_name: 'D-Electricity (UAT Test)',
    category: 'Electricity',
    metadata: {
      billerId: 'DELECTRICITY01',
      billerName: 'D-Electricity (UAT Test)',
      category: 'Electricity',
      inputParams: {
        input: [{ paramName: 'Consumer Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 5. GAS
  // ==========================================
  {
    biller_id: 'ADAN00000GAS',
    biller_name: 'Adani Gas',
    category: 'Gas',
    metadata: {
      billerId: 'ADAN00000GAS',
      billerName: 'Adani Gas',
      category: 'Gas',
      inputParams: {
        input: [{ paramName: 'Customer ID', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'IGL000000GAS',
    biller_name: 'Indraprastha Gas (IGL)',
    category: 'Gas',
    metadata: {
      billerId: 'IGL000000GAS',
      billerName: 'Indraprastha Gas (IGL)',
      category: 'Gas',
      inputParams: {
        input: [{ paramName: 'BP Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'GUJA00000GAS',
    biller_name: 'Gujarat Gas',
    category: 'Gas',
    metadata: {
      billerId: 'GUJA00000GAS',
      billerName: 'Gujarat Gas',
      category: 'Gas',
      inputParams: {
        input: [{ paramName: 'Customer ID', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'DAPL00000GAS01',
    biller_name: 'D-Gas (UAT Test)',
    category: 'Gas',
    metadata: {
      billerId: 'DAPL00000GAS01',
      billerName: 'D-Gas (UAT Test)',
      category: 'Gas',
      inputParams: {
        input: [{ paramName: 'Consumer Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 6. WATER
  // ==========================================
  {
    biller_id: 'DELH00000WAT',
    biller_name: 'Delhi Jal Board',
    category: 'Water',
    metadata: {
      billerId: 'DELH00000WAT',
      billerName: 'Delhi Jal Board',
      category: 'Water',
      inputParams: {
        input: [{ paramName: 'Kno Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'BANG00000WAT',
    biller_name: 'Bangalore Water Supply (BWSSB)',
    category: 'Water',
    metadata: {
      billerId: 'BANG00000WAT',
      billerName: 'Bangalore Water Supply (BWSSB)',
      category: 'Water',
      inputParams: {
        input: [{ paramName: 'RR Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'SURA00000WAT',
    biller_name: 'Surat Municipal Corporation Water',
    category: 'Water',
    metadata: {
      billerId: 'SURA00000WAT',
      billerName: 'Surat Municipal Corporation Water',
      category: 'Water',
      inputParams: {
        input: [{ paramName: 'Tenement Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 7. BROADBAND
  // ==========================================
  {
    biller_id: 'AIRT00000BRO',
    biller_name: 'Airtel Broadband',
    category: 'Broadband',
    metadata: {
      billerId: 'AIRT00000BRO',
      billerName: 'Airtel Broadband',
      category: 'Broadband',
      inputParams: {
        input: [{ paramName: 'Landline / Account Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'JIO000000BRO',
    biller_name: 'JioFiber',
    category: 'Broadband',
    metadata: {
      billerId: 'JIO000000BRO',
      billerName: 'JioFiber',
      category: 'Broadband',
      inputParams: {
        input: [{ paramName: 'JioFiber Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'ACTF00000BRO',
    biller_name: 'ACT Fibernet',
    category: 'Broadband',
    metadata: {
      billerId: 'ACTF00000BRO',
      billerName: 'ACT Fibernet',
      category: 'Broadband',
      inputParams: {
        input: [{ paramName: 'Account ID', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 8. DTH
  // ==========================================
  {
    biller_id: 'TATA00000DTH',
    biller_name: 'Tata Play (Tata Sky)',
    category: 'DTH',
    metadata: {
      billerId: 'TATA00000DTH',
      billerName: 'Tata Play (Tata Sky)',
      category: 'DTH',
      inputParams: {
        input: [{ paramName: 'Subscriber ID / Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'DISH00000DTH',
    biller_name: 'Dish TV',
    category: 'DTH',
    metadata: {
      billerId: 'DISH00000DTH',
      billerName: 'Dish TV',
      category: 'DTH',
      inputParams: {
        input: [{ paramName: 'Viewing Card Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'AIRT00000DTH',
    biller_name: 'Airtel Digital TV',
    category: 'DTH',
    metadata: {
      billerId: 'AIRT00000DTH',
      billerName: 'Airtel Digital TV',
      category: 'DTH',
      inputParams: {
        input: [{ paramName: 'Customer ID', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 9. CABLE TV
  // ==========================================
  {
    biller_id: 'GTPL00000CAB',
    biller_name: 'GTPL Cable TV',
    category: 'Cable TV',
    metadata: {
      billerId: 'GTPL00000CAB',
      billerName: 'GTPL Cable TV',
      category: 'Cable TV',
      inputParams: {
        input: [{ paramName: 'STB / Account Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'HATH00000CAB',
    biller_name: 'Hathway Cable TV',
    category: 'Cable TV',
    metadata: {
      billerId: 'HATH00000CAB',
      billerName: 'Hathway Cable TV',
      category: 'Cable TV',
      inputParams: {
        input: [{ paramName: 'Account Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'DENN00000CAB',
    biller_name: 'Den Networks',
    category: 'Cable TV',
    metadata: {
      billerId: 'DENN00000CAB',
      billerName: 'Den Networks',
      category: 'Cable TV',
      inputParams: {
        input: [{ paramName: 'VC Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 10. LOAN REPAYMENT
  // ==========================================
  {
    biller_id: 'HDFC00000LON',
    biller_name: 'HDFC Bank Loan',
    category: 'Loan Repayment',
    metadata: {
      billerId: 'HDFC00000LON',
      billerName: 'HDFC Bank Loan',
      category: 'Loan Repayment',
      inputParams: {
        input: [{ paramName: 'Loan Account Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'BAJA00000LON',
    biller_name: 'Bajaj Finance',
    category: 'Loan Repayment',
    metadata: {
      billerId: 'BAJA00000LON',
      billerName: 'Bajaj Finance',
      category: 'Loan Repayment',
      inputParams: {
        input: [{ paramName: 'Loan Account Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'MUTH00000LON',
    biller_name: 'Muthoot Finance',
    category: 'Loan Repayment',
    metadata: {
      billerId: 'MUTH00000LON',
      billerName: 'Muthoot Finance',
      category: 'Loan Repayment',
      inputParams: {
        input: [{ paramName: 'Loan Account Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 11. INSURANCE
  // ==========================================
  {
    biller_id: 'LIC000000INS',
    biller_name: 'LIC of India',
    category: 'Insurance',
    metadata: {
      billerId: 'LIC000000INS',
      billerName: 'LIC of India',
      category: 'Insurance',
      inputParams: {
        input: [
          { paramName: 'Policy Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Email ID', dataType: 'EMAIL', optional: 'true' }
        ]
      }
    }
  },
  {
    biller_id: 'HDFL00000INS',
    biller_name: 'HDFC Life Insurance',
    category: 'Insurance',
    metadata: {
      billerId: 'HDFL00000INS',
      billerName: 'HDFC Life Insurance',
      category: 'Insurance',
      inputParams: {
        input: [
          { paramName: 'Policy Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Date of Birth (DDMMYYYY)', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },
  {
    biller_id: 'SBIL00000INS',
    biller_name: 'SBI Life Insurance',
    category: 'Insurance',
    metadata: {
      billerId: 'SBIL00000INS',
      billerName: 'SBI Life Insurance',
      category: 'Insurance',
      inputParams: {
        input: [
          { paramName: 'Policy Number', dataType: 'NUMERIC', optional: 'false' },
          { paramName: 'Date of Birth (DDMMYYYY)', dataType: 'NUMERIC', optional: 'false' }
        ]
      }
    }
  },

  // ==========================================
  // 12. FASTAG
  // ==========================================
  {
    biller_id: 'HDFC00000FAS',
    biller_name: 'HDFC Bank FASTag',
    category: 'FASTag',
    metadata: {
      billerId: 'HDFC00000FAS',
      billerName: 'HDFC Bank FASTag',
      category: 'FASTag',
      inputParams: {
        input: [{ paramName: 'Vehicle Registration Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'SBIC00000FAS',
    biller_name: 'SBI FASTag',
    category: 'FASTag',
    metadata: {
      billerId: 'SBIC00000FAS',
      billerName: 'SBI FASTag',
      category: 'FASTag',
      inputParams: {
        input: [{ paramName: 'Vehicle Registration Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'ICIC00000FAS',
    biller_name: 'ICICI Bank FASTag',
    category: 'FASTag',
    metadata: {
      billerId: 'ICIC00000FAS',
      billerName: 'ICICI Bank FASTag',
      category: 'FASTag',
      inputParams: {
        input: [{ paramName: 'Vehicle Registration Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 13. EDUCATION FEES
  // ==========================================
  {
    biller_id: 'DELH00000EDU',
    biller_name: 'Delhi Public School',
    category: 'Education Fees',
    metadata: {
      billerId: 'DELH00000EDU',
      billerName: 'Delhi Public School',
      category: 'Education Fees',
      inputParams: {
        input: [{ paramName: 'Admission Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'AMIT00000EDU',
    biller_name: 'Amity University',
    category: 'Education Fees',
    metadata: {
      billerId: 'AMIT00000EDU',
      billerName: 'Amity University',
      category: 'Education Fees',
      inputParams: {
        input: [{ paramName: 'Enrollment Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 14. MUNICIPAL TAXES
  // ==========================================
  {
    biller_id: 'AHME00000TAX',
    biller_name: 'Ahmedabad Municipal Corporation (AMC)',
    category: 'Municipal Taxes',
    metadata: {
      billerId: 'AHME00000TAX',
      billerName: 'Ahmedabad Municipal Corporation (AMC)',
      category: 'Municipal Taxes',
      inputParams: {
        input: [{ paramName: 'Tenement Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'SURA00000TAX',
    biller_name: 'Surat Municipal Corporation (SMC)',
    category: 'Municipal Taxes',
    metadata: {
      billerId: 'SURA00000TAX',
      billerName: 'Surat Municipal Corporation (SMC)',
      category: 'Municipal Taxes',
      inputParams: {
        input: [{ paramName: 'Tenement Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 15. HOUSING SOCIETY
  // ==========================================
  {
    biller_id: 'MYGT00000HOU',
    biller_name: 'MyGate Society Payments',
    category: 'Housing Society',
    metadata: {
      billerId: 'MYGT00000HOU',
      billerName: 'MyGate Society Payments',
      category: 'Housing Society',
      inputParams: {
        input: [{ paramName: 'Flat / Villa Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'NOBK00000HOU',
    biller_name: 'NoBrokerHood Maintenance',
    category: 'Housing Society',
    metadata: {
      billerId: 'NOBK00000HOU',
      billerName: 'NoBrokerHood Maintenance',
      category: 'Housing Society',
      inputParams: {
        input: [{ paramName: 'Flat Number / Mobile', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 16. SUBSCRIPTION
  // ==========================================
  {
    biller_id: 'NETF00000SUB',
    biller_name: 'Netflix India',
    category: 'Subscription',
    metadata: {
      billerId: 'NETF00000SUB',
      billerName: 'Netflix India',
      category: 'Subscription',
      inputParams: {
        input: [{ paramName: 'Email ID / Mobile Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'HOTS00000SUB',
    biller_name: 'Disney+ Hotstar',
    category: 'Subscription',
    metadata: {
      billerId: 'HOTS00000SUB',
      billerName: 'Disney+ Hotstar',
      category: 'Subscription',
      inputParams: {
        input: [{ paramName: 'Mobile Number', dataType: 'NUMERIC', optional: 'false' }]
      }
    }
  },

  // ==========================================
  // 17. HOSPITAL
  // ==========================================
  {
    biller_id: 'APOL00000HOS',
    biller_name: 'Apollo Hospitals',
    category: 'Hospital',
    metadata: {
      billerId: 'APOL00000HOS',
      billerName: 'Apollo Hospitals',
      category: 'Hospital',
      inputParams: {
        input: [{ paramName: 'Patient ID', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  },
  {
    biller_id: 'FORT00000HOS',
    biller_name: 'Fortis Healthcare',
    category: 'Hospital',
    metadata: {
      billerId: 'FORT00000HOS',
      billerName: 'Fortis Healthcare',
      category: 'Hospital',
      inputParams: {
        input: [{ paramName: 'Patient / Bill Number', dataType: 'ALPHANUMERIC', optional: 'false' }]
      }
    }
  }
];

async function main() {
  console.log(`Starting to seed ${billers.length} billers across all 17 categories into Supabase...`);
  
  // Clean up existing seeded billers to avoid overlaps or outdated info, 
  // or just run an upsert which will overwrite match by primary key (biller_id)
  
  const { error } = await supabase
    .from('billavenue_billers')
    .upsert(billers);

  if (error) {
    console.error("Error seeding billers:", error);
    process.exit(1);
  }

  console.log("Database seeded successfully!");
}

main().catch(console.error);
