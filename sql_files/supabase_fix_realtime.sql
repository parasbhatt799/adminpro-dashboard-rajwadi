-- આ સ્ક્રિપ્ટ રન કરવાથી રિયલ-ટાઇમ અપડેટ્સમાં આખો ડેટા આવશે
-- જેનાથી પેજ રિફ્રેશ કર્યા વગર સ્ટેટસ બદલાઈ જશે

-- QR Payment Submissions
ALTER TABLE payment_submissions REPLICA IDENTITY FULL;

-- Bill Payment Submissions
ALTER TABLE bill_submissions REPLICA IDENTITY FULL;

-- Complaints & Messages
ALTER TABLE complaints REPLICA IDENTITY FULL;
ALTER TABLE complaint_messages REPLICA IDENTITY FULL;

-- Notifications
ALTER TABLE notifications REPLICA IDENTITY FULL;
