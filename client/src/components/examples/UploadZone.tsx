import { UploadZone } from "../upload-zone";

export default function UploadZoneExample() {
  return (
    <div className="p-6 bg-background max-w-2xl">
      <UploadZone onFileSelect={(file) => console.log("File selected:", file.name)} />
    </div>
  );
}
