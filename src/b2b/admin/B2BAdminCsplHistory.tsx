import React from 'react';
import B2BAPICsplHistory from '../shared/B2BAPICsplHistory';

export default function B2BAdminCsplHistory() {
  return (
    <div className="w-full">
      <B2BAPICsplHistory isAdmin={true} />
    </div>
  );
}
