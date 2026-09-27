import React from 'react';
import B2BAPIPayoutHistory from '../shared/B2BAPIPayoutHistory';

export default function B2BAdminPayoutHistory() {
  return (
    <div className="w-full">
      <B2BAPIPayoutHistory isAdmin={true} />
    </div>
  );
}
