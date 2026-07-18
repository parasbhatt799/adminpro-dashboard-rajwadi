import axios from 'axios';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const CSPL_BASE_URL = 'https://cspl.camlenio.com';
const API_KEY = process.env.CAMLENIO_AEPS_API_KEY || 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7';

// Utility for formatting timestamp for X-TIMESTAMP header
const getISOTimestamp = () => {
    return new Date().toISOString();
};

const getHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': getISOTimestamp(),
        'X-REQUEST-ID': randomUUID(),
        'X-API-KEY': API_KEY,
    };
};

/**
 * Fetch biller info
 */
export const getBillerInfo = async (billerId: string) => {
    try {
        const response = await axios.post(
            `${CSPL_BASE_URL}/bbps/billerinfo`,
            { billerId },
            { headers: getHeaders() }
        );
        return response.data;
    } catch (error: any) {
        console.error('CSPL getBillerInfo error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetch a bill for a specific biller
 */
export const fetchBill = async (billerId: string, customerMobile: string, customerEmail: string, inputParams: any[]) => {
    try {
        const payload = {
            billerId,
            customerMobile,
            customerEmail,
            inputParams
        };
        const response = await axios.post(
            `${CSPL_BASE_URL}/bbps/billfetch`,
            payload,
            { headers: getHeaders() }
        );
        return response.data;
    } catch (error: any) {
        console.error('CSPL fetchBill error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Pay a bill for a specific biller
 */
export const payBill = async (requestData: any) => {
    try {
        const response = await axios.post(
            `${CSPL_BASE_URL}/bbps/billPay`,
            requestData,
            { headers: getHeaders() }
        );
        return response.data;
    } catch (error: any) {
        console.error('CSPL payBill error:', error.response?.data || error.message);
        throw error;
    }
};
