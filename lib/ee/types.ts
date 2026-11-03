export type Material = {
  id: string;
  number: string;
  name: string;
  category: string;
  package: string;
  lifecycle: string;
  description: string;
  parameters: string;
  updatedAt: string;
};
export type Mpn = {
  id: string;
  materialId: string;
  manufacturer: string;
  mpn: string;
  approval: string;
  lifecycle: string;
  datasheet: string;
  notes: string;
};
export type Site = {
  id: string;
  name: string;
  operator: string;
  country: string;
  city: string;
};
export type MpnSite = {
  id: string;
  mpnId: string;
  siteId: string;
  stage: string;
  source: string;
  verifiedAt: string;
};
export type Product = {
  id: string;
  number: string;
  name: string;
  family: string;
  status: string;
};
export type Assembly = {
  id: string;
  number: string;
  name: string;
  type: string;
  revision: string;
};
export type ProductAssembly = {
  id: string;
  productId: string;
  assemblyId: string;
  quantity: number;
};
export type Bom = {
  id: string;
  assemblyId: string;
  revision: string;
  status: string;
};
export type BomLine = {
  id: string;
  bomId: string;
  materialId: string | null;
  childAssemblyId: string | null;
  quantity: number;
  references: string;
  notes: string;
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  createdAt: string;
};
export type Workspace = {
  materials: Material[];
  mpns: Mpn[];
  sites: Site[];
  mpnSites: MpnSite[];
  products: Product[];
  assemblies: Assembly[];
  productAssemblies: ProductAssembly[];
  boms: Bom[];
  bomLines: BomLine[];
  auditLogs: Audit[];
};
