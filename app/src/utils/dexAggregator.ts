import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Jupiter } from '@jup-ag/api';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  routes: any[];
  bestRoute: any;
  priceImpactPct: number;
  marketInfos: any[];
}

export interface SwapResult {
  transaction: Transaction;
  quote: SwapQuote;
  expectedOutput: number;
  minimumOutput: number;
  feeAmount: number;
}

export class DEXAggregator {
  private connection: Connection;
  private jupiter: Jupiter;

  constructor(connection: Connection) {
    this.connection = connection;
    this.jupiter = new Jupiter({ connection });
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<SwapQuote> {
    try {
      const quote = await this.jupiter.quote({
        inputMint,
        outputMint,
        amount,
        slippageBps,
      });

      return {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        routes: quote.routes,
        bestRoute: quote.routes[0],
        priceImpactPct: quote.routes[0]?.priceImpactPct || 0,
        marketInfos: quote.routes[0]?.marketInfos || [],
      };
    } catch (error) {
      console.error('Error getting quote:', error);
      throw error;
    }
  }

  async buildSwapTransaction(
    quote: SwapQuote,
    userPublicKey: PublicKey,
    referralCode?: string
  ): Promise<SwapResult> {
    try {
      const swapTransaction = await this.jupiter.swap({
        route: quote.bestRoute,
        userPublicKey: userPublicKey.toBase58(),
        wrapUnwrapSOL: true,
        referralAccount: referralCode ? this.getReferralAccount(referralCode) : undefined,
      });

      const expectedOutput = this.calculateExpectedOutput(quote);
      const minimumOutput = expectedOutput * (1 - quote.slippageBps / 10000);
      const feeAmount = this.calculateFee(quote.amount);

      return {
        transaction: Transaction.from(swapTransaction.swapTransaction),
        quote,
        expectedOutput,
        minimumOutput,
        feeAmount,
      };
    } catch (error) {
      console.error('Error building swap transaction:', error);
      throw error;
    }
  }

  async executeSwap(
    swapResult: SwapResult,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<string> {
    try {
      const signedTransaction = await signTransaction(swapResult.transaction);
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize()
      );
      await this.connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  private calculateExpectedOutput(quote: SwapQuote): number {
    const route = quote.bestRoute;
    if (!route) return 0;
    
    let outputAmount = route.outAmount;
    const decimals = 9; // Should be fetched from token metadata
    return outputAmount / Math.pow(10, decimals);
  }

  private calculateFee(amount: number): number {
    const feeBps = 30; // 0.3% fee
    return (amount * feeBps) / 10000;
  }

  private getReferralAccount(referralCode: string): string {
    // In production, this should map referral codes to fee accounts
    const referralAccounts: { [key: string]: string } = {
      'DEFAULT': '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      // Add more referral code mappings here
    };
    return referralAccounts[referralCode] || referralAccounts['DEFAULT'];
  }
  }
