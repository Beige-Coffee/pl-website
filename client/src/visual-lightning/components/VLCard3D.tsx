export function VLCard3D({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`vl-card-3d ${className || ""}`}>
      <div className="vl-card-3d-inner p-6">
        {children}
      </div>
    </div>
  );
}
