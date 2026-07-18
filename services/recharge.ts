import { callBillAvenueApi, generateRequestId } from './billavenue.js';
import dotenv from 'dotenv';

dotenv.config();

const AGENT_ID = (process.env.BILLAVENUE_AGENT_ID || 'CC01CC01513515340681').replace(/['"]/g, '').trim();
const IS_PROD = process.env.BILLAVENUE_ENV === 'production';
const BASE_URL = IS_PROD ? 'https://api.billavenue.com' : 'https://stgapi.billavenue.com';

const RECHARGE_ENDPOINTS = {
  mnp: `${BASE_URL}/billpay/extMnp/mnpRequest/xml`,
  deposit: IS_PROD
    ? `${BASE_URL}/billpay/enquireDeposit/fetchDetails/xml`
    : `${BASE_URL}/billpay/extDeposit/enquiry/xml`,
  plans: `${BASE_URL}/billpay/extFetchPlans/fetchPlansRequest/xml`,
  validate: `${BASE_URL}/billpay/extBillValCntrl/billValidationRequest/xml`,
  pay: `${BASE_URL}/billpay/extBillPayCntrl/billPayRequest/xml`,
  status: `${BASE_URL}/billpay/transactionStatus/fetchInfo/xml`
};

// Static Staging Biller IDs for Operators
const OPERATORS = [
  { billerId: 'AIRT00000PRE', billerName: 'Airtel Prepaid', category: 'Mobile Prepaid' },
  { billerId: 'JIO000000PRE', billerName: 'Jio Prepaid', category: 'Mobile Prepaid' },
  { billerId: 'VODA00000PRE', billerName: 'Vi Prepaid', category: 'Mobile Prepaid' },
  { billerId: 'BSNL00000PRE', billerName: 'BSNL Prepaid', category: 'Mobile Prepaid' }
];

// MNP Local fallback mapping for prefix-based resolver
const PREFIX_OPERATORS: Record<string, { operator: string; circle: string; billerId: string }> = {
  '9999': { operator: 'Airtel Prepaid', circle: 'Delhi', billerId: 'AIRT00000PRE' },
  '9876': { operator: 'Jio Prepaid', circle: 'Punjab', billerId: 'JIO000000PRE' },
  '9000': { operator: 'Vi Prepaid', circle: 'Andhra Pradesh', billerId: 'VODA00000PRE' },
  '9444': { operator: 'BSNL Prepaid', circle: 'Tamil Nadu', billerId: 'BSNL00000PRE' }
};

/**
 * Fetch supported recharge operators
 */
export async function getRechargeOperators() {
  return {
    responseCode: '0000',
    operators: OPERATORS
  };
}

/**
 * Detect Operator and Circle using Mobile Number (MNP API with Local Fallback)
 */
export async function detectOperatorMNP(mobile: string): Promise<any> {
  const prefix = mobile.slice(0, 4);
  const fallback = PREFIX_OPERATORS[prefix] || { operator: 'Jio Prepaid', circle: 'Gujarat', billerId: 'JIO000000PRE' };

  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mnpRequest>
    <agentId>${AGENT_ID}</agentId>
    <mobileNo>${mobile}</mobileNo>
</mnpRequest>`;

    const response = await callBillAvenueApi(RECHARGE_ENDPOINTS.mnp, xml);
    const mnpResponse = response.json?.mnpResponse;

    if (mnpResponse && (mnpResponse.responseCode === '000' || mnpResponse.responseCode === '0000' || mnpResponse.status === 'SUCCESS')) {
      const detectedOp = mnpResponse.currentOperator || mnpResponse.operator || fallback.operator;
      const detectedLoc = mnpResponse.currentLocation || mnpResponse.circle || fallback.circle;

      const matchingBiller = OPERATORS.find(op =>
        op.billerName.toLowerCase().includes(detectedOp.toLowerCase()) ||
        detectedOp.toLowerCase().includes(op.billerName.split(' ')[0].toLowerCase())
      ) || OPERATORS[1]; // Fallback to Jio

      return {
        operator: matchingBiller.billerName,
        billerId: matchingBiller.billerId,
        circle: detectedLoc
      };
    }
  } catch (err: any) {
    console.warn('[Recharge MNP] API failed, using prefix fallback:', err.message);
  }

  return fallback;
}

/**
 * Fetch Recharge plans for operator and circle
 */
export async function getRechargePlans(billerId: string, circle: string, mobile?: string): Promise<any> {
  const isAirtelOrVi = billerId.includes('AIRT') || billerId.includes('VODA') || billerId.includes('VI') || billerId.includes('IDEA');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rechargePlanRequest>
    <billerId>${billerId}</billerId>
    <circle>${circle}</circle>
    ${isAirtelOrVi && mobile ? `
    <agentId>${AGENT_ID}</agentId>
    <mobileNo>${mobile}</mobileNo>
    ` : ''}
</rechargePlanRequest>`;

  return callBillAvenueApi(RECHARGE_ENDPOINTS.plans, xml);
}

/**
 * Validate Recharge details
 */
export async function validateRecharge(mobile: string, billerId: string, amount: number): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billValidationRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <customerInfo>
        <customerMobile>${mobile}</customerMobile>
    </customerInfo>
    <inputParams>
        <input>
            <paramName>Mobile Number</paramName>
            <paramValue>${mobile}</paramValue>
        </input>
    </inputParams>
    <amount>${Math.round(amount * 100)}</amount>
</billValidationRequest>`;

  return callBillAvenueApi(RECHARGE_ENDPOINTS.validate, xml);
}

/**
 * Execute Mobile Recharge Payment
 */
export async function rechargeMobile(
  mobile: string,
  billerId: string,
  amount: number,
  planId?: string,
  remitterName?: string
): Promise<any> {
  const amountInPaise = Math.round(amount * 100);
  const paymentRefId = generateRequestId();
  const nameOfRemitter = remitterName || 'UsePay Customer';

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<billPaymentRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <customerInfo>
        <customerMobile>${mobile}</customerMobile>
    </customerInfo>
    <inputParams>
        <input>
            <paramName>Mobile Number</paramName>
            <paramValue>${mobile}</paramValue>
        </input>
    </inputParams>
    <amountInfo>
        <amount>${amountInPaise}</amount>
        <currency>356</currency>
        <custConvFee>0</custConvFee>
    </amountInfo>
    <paymentMethod>
        <paymentMode>UPI</paymentMode>
        <quickPay>Y</quickPay>
        <splitPay>N</splitPay>
    </paymentMethod>
    <paymentInfo>
        <info>
            <infoName>Remitter Name</infoName>
            <infoValue>${nameOfRemitter}</infoValue>
        </info>
        <info>
            <infoName>PaymentRefId</infoName>
            <infoValue>${paymentRefId}</infoValue>
        </info>
        <info>
            <infoName>Payment Account Info</infoName>
            <infoValue>${mobile}@upi</infoValue>
        </info>
        <info>
            <infoName>Payment mode</infoName>
            <infoValue>UPI</infoValue>
        </info>
    </paymentInfo>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>INT</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <billerAdhoc>true</billerAdhoc>
    ${planId ? `<planId>${planId}</planId>` : ''}
</billPaymentRequest>`;

  return callBillAvenueApi(RECHARGE_ENDPOINTS.pay, xml);
}

/**
 * Fetch Recharge status
 */
export async function getRechargeStatus(requestId: string, trackType: string = 'recharge'): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<transactionStatusRequest>
    <agentId>${AGENT_ID}</agentId>
    <requestId>${requestId}</requestId>
    <trackType>${trackType}</trackType>
</transactionStatusRequest>`;

  return callBillAvenueApi(RECHARGE_ENDPOINTS.status, xml);
}

/**
 * Enquire agent deposit wallet balance
 */
export async function getDepositBalance(): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<depositEnquiryRequest>
    <agentId>${AGENT_ID}</agentId>
</depositEnquiryRequest>`;

  return callBillAvenueApi(RECHARGE_ENDPOINTS.deposit, xml);
}
