import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import WebSocket from 'ws';

// Polyfill WebSocket for Node 18
(global as any).WebSocket = WebSocket;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importBillers() {
  console.log("==================================================");
  console.log("Starting Master Biller Import from Excel...");
  
  const excelPath = path.join(process.cwd(), 'billers.xlsx.xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.error(`Excel file not found at: ${excelPath}`);
    console.error("Please make sure the file is named 'billers.xlsx.xlsx' and is in the main project folder.");
    process.exit(1);
  }

  try {
    console.log("Reading Excel file...");
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rows = xlsx.utils.sheet_to_json(sheet) as any[];
    console.log(`Found ${rows.length} rows in the Excel file.`);

    if (rows.length === 0) {
      console.log("No data found in Excel.");
      return;
    }

    // Determine column names dynamically based on the first row
    const firstRow = rows[0];
    const colId = Object.keys(firstRow).find(k => k.toLowerCase().includes('id')) || 'blr_id';
    const colName = Object.keys(firstRow).find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('alias')) || 'blr_name';
    const colCategory = Object.keys(firstRow).find(k => k.toLowerCase().includes('category')) || 'blr_category_name';

    console.log(`Using columns - ID: ${colId}, Name: ${colName}, Category: ${colCategory}`);

    const mapped = rows.map((row: any) => {
      // The Excel file has limited data. We set customerParamGroups to null
      // so the backend knows to fetch it on-demand via the API later.
      const billerData = {
        billerId: row[colId],
        billerName: row[colName],
        billerCategoryName: row[colCategory],
        billerCoverage: row['blr_coverage'] || 'IND',
        billerAliasName: row['blr_alias_name'] || row[colName]
      };

      return {
        biller_id: row[colId],
        biller_name: row[colName],
        category: row[colCategory],
        metadata: billerData
      };
    }).filter(b => b.biller_id); // Ensure ID is present

    console.log(`Successfully mapped ${mapped.length} valid billers.`);
    console.log("Starting database synchronization (this may take a few minutes)...");
    
    console.log("Clearing old billers from the database...");
    const { error: deleteError } = await supabase
      .from('billavenue_billers')
      .delete()
      .neq('biller_id', 'NON_EXISTENT_DUMMY_ID_123'); // Deletes all rows

    if (deleteError) {
      console.warn("Could not clear old billers automatically:", deleteError.message);
    } else {
      console.log("Old billers successfully removed.");
    }

    const BATCH_SIZE = 500;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const chunk = mapped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('billavenue_billers').upsert(chunk);
      
      if (error) {
        console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        failCount += chunk.length;
      } else {
        successCount += chunk.length;
        process.stdout.write(`\rProgress: ${successCount}/${mapped.length} billers inserted...`);
      }
    }

    console.log("\n==================================================");
    console.log("Sync Complete!");
    console.log(`Total Billers Successfully Synced: ${successCount}`);
    if (failCount > 0) {
      console.log(`Failed to Sync: ${failCount}`);
    }
    console.log("==================================================");

  } catch (error: any) {
    console.error("Sync failed with error:");
    console.error(error);
  }
}

importBillers();
