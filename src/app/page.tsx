import { getPurchasingDashboardData } from "./actions";
import PurchasingClient from "@/components/PurchasingClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getPurchasingDashboardData();
  return <PurchasingClient initialData={data} />;
}
