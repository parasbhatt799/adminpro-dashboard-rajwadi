import './DashboardIllustration.css';

export default function DashboardIllustration() {
  return (
    <div className="animation-container">
      <div className="circle c-1"></div>
      <div className="circle c-2"></div>
      <div className="circle c-3"></div>
      <div className="circle c-4"></div>
      <div className="circle c-5"></div>
      <div className="circle c-6"></div>
      <div className="circle c-9"></div>
      
      {/* Nested Circle: 7 is inside 8 */}
      <div className="circle c-8">
        <div className="circle c-7"></div>
      </div>
    </div>
  );
}
