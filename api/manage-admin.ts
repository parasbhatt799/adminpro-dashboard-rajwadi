import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, password, mobileNumber } = req.body;

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase configuration missing in process.env");
    return res.status(500).json({ 
      error: "Supabase Service Role Key is missing in Vercel environment variables. Please add it in the Vercel Dashboard." 
    });
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    let formattedMobile = mobileNumber;
    // Add +91 if not present (assuming India based on project context)
    if (!formattedMobile.startsWith('+')) {
      formattedMobile = `+91${formattedMobile.replace(/^0+/, '')}`;
    }

    if (action === 'create') {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        phone: formattedMobile,
        password: password,
        phone_confirm: true
      });
      if (error) throw error;
      return res.status(200).json({ success: true, user: data.user });
    } 
    
    if (action === 'delete') {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const user = usersData.users.find((u: any) => u.phone?.replace('+', '') === mobileNumber.replace('+', ''));
      if (!user) {
        return res.status(200).json({ success: true, message: "User not found in Auth, but proceeding." });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
      
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('Admin management error via Vercel:', error);
    return res.status(500).json({ error: error.message });
  }
}
