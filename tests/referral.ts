```typescript
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Referral } from "../target/types/referral";
import { expect } from "chai";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("referral", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Referral as Program<Referral>;
  
  const authority = anchor.web3.Keypair.generate();
  const referrer = anchor.web3.Keypair.generate();
  const user = anchor.web3.Keypair.generate();

  let statePDA: PublicKey;
  let referrerPDA: PublicKey;
  let feeVaultPDA: PublicKey;

  before(async () => {
    // Airdrop SOL to accounts
    const signature1 = await provider.connection.requestAirdrop(
      authority.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature1);

    const signature2 = await provider.connection.requestAirdrop(
      referrer.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature2);

    const signature3 = await provider.connection.requestAirdrop(
      user.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature3);

    // Find PDAs
    [statePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    [referrerPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("referrer"), referrer.publicKey.toBuffer()],
      program.programId
    );

    [feeVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault"), statePDA.toBuffer()],
      program.programId
    );
  });

  it("Initializes the program", async () => {
    await program.methods
      .initialize(30, 7000) // 0.3% fee, 70% to referrer
      .accounts({
        state: statePDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const state = await program.account.programState.fetch(statePDA);
    expect(state.authority.toString()).to.equal(authority.publicKey.toString());
    expect(state.feeBps).to.equal(30);
    expect(state.referrerShareBps).to.equal(7000);
  });

  it("Registers a referrer", async () => {
    await program.methods
      .registerReferrer("TEST123")
      .accounts({
        referrer: referrerPDA,
        owner: referrer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([referrer])
      .rpc();

    const referrerAccount = await program.account.referrer.fetch(referrerPDA);
    expect(referrerAccount.owner.toString()).to.equal(referrer.publicKey.toString());
    expect(referrerAccount.referralCode).to.equal("TEST123");
    expect(referrerAccount.totalReferred.toNumber()).to.equal(0);
  });

  it("Tracks a referral", async () => {
    const [userReferralPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_referral"), user.publicKey.toBuffer(), Buffer.from("TEST123")],
      program.programId
    );

    await program.methods
      .trackReferral("TEST123")
      .accounts({
        userReferral: userReferralPDA,
        referrer: referrerPDA,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const userReferral = await program.account.userReferral.fetch(userReferralPDA);
    expect(userReferral.user.toString()).to.equal(user.publicKey.toString());
    expect(userReferral.referrer.toString()).to.equal(referrer.publicKey.toString());

    const referrerAccount = await program.account.referrer.fetch(referrerPDA);
    expect(referrerAccount.totalReferred.toNumber()).to.equal(1);
  });

  it("Updates fees", async () => {
    await program.methods
      .updateFees(25, 8000) // 0.25% fee, 80% to referrer
      .accounts({
        state: statePDA,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const state = await program.account.programState.fetch(statePDA);
    expect(state.feeBps).to.equal(25);
    expect(state.referrerShareBps).to.equal(8000);
  });
});
```
