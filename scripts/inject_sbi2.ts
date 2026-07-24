import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const sbiMetadata = {
  "billerId": "SBIC00000NATDN",
  "billerAliasName": "SBI Card",
  "billerName": "SBI Card",
  "billerCategory": "Credit Card",
  "billerAdhoc": "true",
  "billerCoverage": "IND",
  "billerFetchRequiremet": "MANDATORY",
  "billerPaymentExactness": "",
  "billerSupportBillValidation": "NOT_SUPPORTED",
  "supportPendingStatus": "Yes",
  "supportDeemed": "Yes",
  "billerStatus": "ACTIVE",
  "billerTimeout": "120",
  "billerInputParams": {
    "paramInfo": [
      {
        "paramName": "Last 4 digit of primary credit card number",
        "dataType": "NUMERIC",
        "isOptional": "false",
        "minLength": "4",
        "maxLength": "4",
        "regEx": "^[0-9]{4,4}$",
        "visibility": "true"
      },
      {
        "paramName": "Mobile Number",
        "dataType": "NUMERIC",
        "isOptional": "false",
        "minLength": "10",
        "maxLength": "10",
        "regEx": "^[6-9][0-9]{9}$",
        "visibility": "true"
      }
    ]
  },
  "billerAdditionalInfo": {
    "paramInfo": [
      {
        "paramName": "Minimum Amount Due"
      },
      {
        "paramName": "Maximum Permissible Amount"
      }
    ]
  },
  "billerAmountOptions": "BASE_BILL_AMOUNT,,,",
  "interchangeFeeCCF1": {
    "feeCode": "CCF1",
    "feeDirection": "C2B",
    "flatFee": "0",
    "percentFee": "0.00",
    "feeMinAmt": "1",
    "feeMaxAmt": "2147483647"
  },
  "mdm_fetched": true
};

async function inject() {
  const { data, error } = await supabase
    .from('billavenue_billers')
    .update({ metadata: sbiMetadata })
    .eq('biller_id', 'SBIC00000NATDN');

  if (error) {
    console.error("Error updating:", error);
  } else {
    console.log("Successfully injected TRUE SBI Credit Card metadata into database!");
  }
}

inject();
