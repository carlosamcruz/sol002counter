import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CounterProgram } from "../target/types/counter_program";
import { assert, expect } from "chai";

describe("counter_program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.counter_program as Program<CounterProgram>;

  const counterAccount = anchor.web3.Keypair.generate();
  const owner = anchor.web3.Keypair.generate();
  const otherAccount = anchor.web3.Keypair.generate();

  async function airdrop(pubkey: anchor.web3.PublicKey, lamports = 2e9) {
    // 2 SOL em devnet; ajuste se o faucet limitar a 1 SOL
    const { blockhash, lastValidBlockHeight } = await provider.connection.getLatestBlockhash();
    const sig = await provider.connection.requestAirdrop(pubkey, lamports);
    await provider.connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  }
  before(async () => {
    // Necessário se estiver em devnet (ou local validator desligado)
    await airdrop(owner.publicKey, 1e9);
    await airdrop(otherAccount.publicKey, 2e9);
  });  
  
  it("Initializes the counter with 0.1 SOL", async () => {
  
    const startValue = new anchor.BN(2);
    const initialLamports = new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL); // 0.1 SOL
    
    const tx = await program.methods
      .initialize(startValue, initialLamports)
      .accounts({
        counter: counterAccount.publicKey,
        user: owner.publicKey,
      })
      .signers([counterAccount, owner])
      .rpc();
    
    console.log("Initialize tx:", tx);
    
    const state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 2);
    
    const bal = await provider.connection.getBalance(counterAccount.publicKey);
    assert.ok(bal >= 0.1 * anchor.web3.LAMPORTS_PER_SOL); // funded in the same call
    
  });

  //Teste dependente do anterior
  it("Increments and decrements the counter", async () => {
    
    await program.methods
      .increment()
      .accounts({
        counter: counterAccount.publicKey,
        user: otherAccount.publicKey,
      })
      .signers([otherAccount])
      .rpc();

    let state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 3);

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: otherAccount.publicKey,
      })
      .signers([otherAccount])
      .rpc();

    state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 2);
  });
  
  //Teste dependente do anterior
  it("Decrements 4 times the counter", async () => {
    
    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: otherAccount.publicKey,
      })
      .signers([otherAccount])
      .rpc();

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: otherAccount.publicKey,
      })
      .signers([otherAccount])
      .rpc();      

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: otherAccount.publicKey,
      })
      .signers([otherAccount])
      .rpc();

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: otherAccount.publicKey,
      })
      .signers([otherAccount])
      .rpc();      

    let state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), -2);
  });

  //Teste dependente do teste anterior
  it("Increments 4 times the counter", async () => {
    
    for(let i = 0; i < 4; i++) 
      await program.methods
        .increment()
        .accounts({
          counter: counterAccount.publicKey,
          user: otherAccount.publicKey,
        })
        .signers([otherAccount])
        .rpc();

    let state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 2);

  });


  //Teste dependente do teste anterior
  it("Can't finalize the contract - count too low", async () => {

    //Com este metodo eu posso pegar os erros sem necessidade de plugins extras;
    try {
      await program.methods
        .finalize()
        .accounts({
          counter: counterAccount.publicKey,
          owner: otherAccount.publicKey,
        })
        .signers([otherAccount])
        .rpc();
      
      // If we got here, the call didn't fail as expected
      assert.fail("Expected transaction to be reverted due to count < 3");
    } catch (err: any) {
      // Optional: check specific Anchor error code or message
      expect(err.message).to.include("Count must be at least 3 to finalize.");
    }

  });


  it("Should finalize the contract (prints balances before/after)", async () => {
    const conn = provider.connection;
  
    // 4 interações (cada uma paga 0.01 SOL para a conta 'counter')
    for (let i = 0; i < 4; i++) {
      await program.methods
        .increment()
        .accounts({
          counter: counterAccount.publicKey,
          user: otherAccount.publicKey, // este é quem paga a taxa por interação
        })
        .signers([otherAccount])
        .rpc();
    }
  
    // estado deve ter sido incrementado
    let state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 6);
  
    // --- saldos antes do finalize ---
    const counterBalBefore = await conn.getBalance(counterAccount.publicKey);
    const ownerBalBefore = await conn.getBalance(owner.publicKey);
  
    const lamportsToSol = (lamports: number) =>
      lamports / anchor.web3.LAMPORTS_PER_SOL;
  
    console.log(">> BEFORE FINALIZE");
    console.log("counter balance (lamports):", counterBalBefore, "| SOL:", lamportsToSol(counterBalBefore));
    console.log("owner   balance (lamports):", ownerBalBefore,    "| SOL:", lamportsToSol(ownerBalBefore));
  
    // --- finalize (owner deve assinar) ---
    const finalizeSig = await program.methods
      .finalize()
      .accounts({
        counter: counterAccount.publicKey,
        owner: owner.publicKey, // deve ser o owner gravado na conta
      })
      .signers([owner]) // IMPORTANTE: owner assina a instrução
      .rpc();
  
    console.log("Finalize tx:", finalizeSig);

    // fetch full transaction details
    const txDetails = await provider.connection.getTransaction(finalizeSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0, // include v0 transactions
    });

    console.log("Raw Transaction Details:", JSON.stringify(txDetails, null, 2));
  
    // --- após finalizar: conta 'counter' fechada; lamports vão para o owner ---
    const ownerBalAfter = await conn.getBalance(owner.publicKey);
  
    console.log(">> AFTER FINALIZE");
    console.log("owner balance (lamports):", ownerBalAfter, "| SOL:", lamportsToSol(ownerBalAfter));
  
    // a conta fechada não pode mais ser buscada
    try {
      await program.account.counterAccount.fetch(counterAccount.publicKey);
      assert.fail("Should not be able to fetch closed account");
    } catch (e: any) {
      assert.include(e.message, "Account does not exist");
    }
  
    // verificação: owner recebeu (aprox) o saldo da counter
    // (nota: haverá uma pequena diferença por taxa da transação de finalize)
    const delta = ownerBalAfter - ownerBalBefore;
    console.log("owner delta (lamports):", delta, "| SOL:", lamportsToSol(delta));
  
    assert.ok(
      delta >= counterBalBefore * 0.99, // margem para taxas; ajuste se quiser ser mais estrito
      "Owner should receive (almost) all lamports from the counter account"
    );
  });
  

  it("ReInitializes the counter with 0.0 SOL", async () => {
  
    const startValue = new anchor.BN(4);
    const initialLamports = new anchor.BN(0.0 * anchor.web3.LAMPORTS_PER_SOL); // 0.1 SOL
    
    const tx = await program.methods
      .initialize(startValue, initialLamports)
      .accounts({
        counter: counterAccount.publicKey,
        user: owner.publicKey,
      })
      .signers([counterAccount, owner])
      .rpc();
    
    console.log("Initialize tx:", tx);
    
    const state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 4);
    
    const bal = await provider.connection.getBalance(counterAccount.publicKey);
    assert.ok(bal >= 0.0 * anchor.web3.LAMPORTS_PER_SOL); // funded in the same call
    
  });

  //Teste dependente do teste anterior
  it("Can't finalize the contract - balance too low", async () => {

    //Com este metodo eu posso pegar os erros sem necessidade de plugins extras;
    try {
      await program.methods
        .finalize()
        .accounts({
          counter: counterAccount.publicKey,
          owner: owner.publicKey,
        })
        .signers([owner])
        .rpc();
      
      // If we got here, the call didn't fail as expected
      assert.fail("Expected transaction to be reverted due to balance < 0.1 Sol");
    } catch (err: any) {
      // Optional: check specific Anchor error code or message
      expect(err.message).to.include("Contract balance must be at least 0.1 SOL to finalize.");
    }

  });

});