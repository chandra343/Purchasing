// Client Komunikasi Terintegrasi ke Project Gudang (http://localhost:3000)
const GUDANG_BASE_URL = process.env.GUDANG_API_URL || "http://localhost:3000";

export async function checkGudangConnection() {
  try {
    const res = await fetch(`${GUDANG_BASE_URL}/api/integration/purchasing`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      // timeout 3s
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { connected: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { connected: true, data };
  } catch (err: any) {
    return { connected: false, error: err.message || "Gudang offline" };
  }
}

export async function getGudangProducts(companyId?: string) {
  try {
    const url = companyId
      ? `${GUDANG_BASE_URL}/api/integration/purchasing/products?companyId=${companyId}`
      : `${GUDANG_BASE_URL}/api/integration/purchasing/products`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

export async function getGudangLowStock(companyId?: string) {
  try {
    const url = companyId
      ? `${GUDANG_BASE_URL}/api/integration/purchasing/low-stock?companyId=${companyId}`
      : `${GUDANG_BASE_URL}/api/integration/purchasing/low-stock`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

export async function getGudangRequisitions(companyId?: string) {
  try {
    const url = companyId
      ? `${GUDANG_BASE_URL}/api/integration/purchasing/requisitions?companyId=${companyId}`
      : `${GUDANG_BASE_URL}/api/integration/purchasing/requisitions`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

export async function getGudangOrders(companyId?: string) {
  try {
    const url = companyId
      ? `${GUDANG_BASE_URL}/api/integration/purchasing/orders?companyId=${companyId}`
      : `${GUDANG_BASE_URL}/api/integration/purchasing/orders`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    return [];
  }
}

export async function pushPOToGudang(poData: {
  poNumber: string;
  supplierName: string;
  supplierPhone?: string;
  supplierAddress?: string;
  notes?: string;
  expectedDate?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    price?: number;
  }>;
}) {
  try {
    const res = await fetch(`${GUDANG_BASE_URL}/api/integration/purchasing/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(poData),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
