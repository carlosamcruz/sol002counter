import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
//import { Sol002counter } from "../target/types/sol002counter";
import { CounterProgram } from "../target/types/counter_program";
import { assert, expect } from "chai";


describe("counter_program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.counter_program as Program<CounterProgram>;
  const user = provider.wallet;

  let userAny: anchor.web3.Keypair;

  let counterAccountIndependent: anchor.web3.Keypair;

  //Para testes interdependentes
  //const counterAccount = anchor.web3.Keypair.generate();
  
  //Para testes independentes
  beforeEach(async () => {
    counterAccountIndependent = anchor.web3.Keypair.generate();
    userAny = anchor.web3.Keypair.generate();
  });

  //guarda apenas a primeira conta gerada
  let counterAccount: anchor.web3.Keypair;

  it("Initializes the counter", async () => {

    counterAccount = counterAccountIndependent;

    const tx = await program.methods
      .initialize(new anchor.BN(2))
      .accounts({
        counter: counterAccountIndependent.publicKey,
        user: user.publicKey,
        //systemProgram: anchor.web3.SystemProgram.programId, // ✅ correct key name
      })
      .signers([counterAccountIndependent])
      .rpc();

    console.log("Initialize tx:", tx);

    console.log("counterAccountIndependent: ", counterAccountIndependent.publicKey);
    console.log("counterAccount: ", counterAccount.publicKey);

    const state = await program.account.counterAccount.fetch(counterAccountIndependent.publicKey);
    assert.equal(state.count.toNumber(), 2);
    //assert.equal(state.finalized, false);
  });

  //Teste independente do anterior
  it("Increments and decrements the counter", async () => {
    await program.methods
      .initialize(new anchor.BN(1))
      .accounts({
        counter: counterAccountIndependent.publicKey,
        user: user.publicKey,
        //systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([counterAccountIndependent])
      .rpc();

    await program.methods
      .increment()
      .accounts({
        counter: counterAccountIndependent.publicKey,
        user: user.publicKey,
      })
      .rpc();

    let state = await program.account.counterAccount.fetch(counterAccountIndependent.publicKey);
    assert.equal(state.count.toNumber(), 2);

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccountIndependent.publicKey,
        user: user.publicKey,
      })
      .rpc();

    state = await program.account.counterAccount.fetch(counterAccountIndependent.publicKey);
    assert.equal(state.count.toNumber(), 1);
  });

  //Teste dependente do primeiro test
  it("Increments and decrements the counter", async () => {
    
    /*
    await program.methods
      .initialize(new anchor.BN(1))
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
        //systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([counterAccount])
      .rpc();

    */ 

    await program.methods
      .increment()
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
      })
      .rpc();

    let state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 3);

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
      })
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
        user: user.publicKey,
      })
      .rpc();

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
      })
      .rpc();      

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
      })
      .rpc();

    await program.methods
      .decrement()
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
      })
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
          user: user.publicKey,
        })
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
          user: user.publicKey,
        })
        .rpc();
      
      // If we got here, the call didn't fail as expected
      assert.fail("Expected transaction to be reverted due to count < 3");
    } catch (err: any) {
      // Optional: check specific Anchor error code or message
      expect(err.message).to.include("Count must be at least 3 to finalize.");
    }

  });

  //Teste dependente do teste anterior
  it("Should finalize the contract", async () => {

    for(let i = 0; i < 4; i++) 
      await program.methods
        .increment()
        .accounts({
          counter: counterAccount.publicKey,
          user: userAny.publicKey,
        })
        .rpc();

    let state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    assert.equal(state.count.toNumber(), 6);

    await program.methods
      .finalize()
      .accounts({
        counter: counterAccount.publicKey,
        user: user.publicKey,
      })
      .rpc();    

    // ✅ Do not try to fetch the account now.
    // You can test indirectly, like checking that the account no longer exists:
    try {
      await program.account.counterAccount.fetch(counterAccount.publicKey);
      assert.fail("Should not be able to fetch closed account");
    } catch (e) {
      assert.include(e.message, "Account does not exist");
    }

    //state = await program.account.counterAccount.fetch(counterAccount.publicKey);
    //assert.equal(state.finalized, true);

  });

});
