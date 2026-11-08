import {SmartMoneyWalletPage} from '@/features/research/smart-money';
export default async function Page({params}:{params:Promise<{address:string}>}){return <SmartMoneyWalletPage address={(await params).address}/>;}
