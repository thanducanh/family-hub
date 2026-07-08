import { collectionHandlers } from "@/lib/api-collections";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const { GET, POST, PUT, DELETE } = collectionHandlers("transactions");
