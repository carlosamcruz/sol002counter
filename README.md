# 🧮 Counter Program on Solana (Anchor Framework)

This Solana smart contract implements a simple **counter** that can be incremented or decremented by **anyone**, and finalized (closed) by the creator when the count reaches a minimum threshold.

## ✨ Features

- ✅ Initialize a counter with a custom starting value.
- ➕ Anyone can increment the counter.
- ➖ Anyone can decrement the counter.
- 🔒 Finalize (close) the account when the counter reaches **3 or more**, returning all lamports to the original user.
- 🛡️ Minimal permission system — increment and decrement functions are **open to all**.

---

## 🛠️ Instructions

### `initialize(start_value: i64)`
Creates and initializes a new counter account with the given starting value.

- ✅ Can only be called once per account.
- 🔐 Requires payer (`user`) signature.

```ts
await program.methods
  .initialize(new anchor.BN(0))
  .accounts({
    counter: counterAccount.publicKey,
    user: payer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([payer])
  .rpc();
````

---

### `increment()`

Increases the counter by 1.

* 🌎 **Permissionless** — any user can call this.
* 🔓 No signer required.

```ts
await program.methods
  .increment()
  .accounts({
    counter: counterAccount.publicKey,
    user: someUser.publicKey,
  })
  .rpc();
```

---

### `decrement()`

Decreases the counter by 1.

* 🌎 **Permissionless** — any user can call this.
* 🔓 No signer required.

```ts
await program.methods
  .decrement()
  .accounts({
    counter: counterAccount.publicKey,
    user: someUser.publicKey,
  })
  .rpc();
```

---

### `finalize()`

Closes the counter account, **refunding lamports** to the user, if `count >= 3`.

* ✅ Requires signer (`user`).
* 🧨 Permanently destroys the counter account.

```ts
await program.methods
  .finalize()
  .accounts({
    counter: counterAccount.publicKey,
    user: payer.publicKey,
  })
  .signers([payer])
  .rpc();
```

---

## 📚 Account Structure

### `CounterAccount`

| Field   | Type | Description         |
| ------- | ---- | ------------------- |
| `count` | i64  | Current count value |

---

## ⚠️ Errors

* `CountNotHighEnough`: Returned if `finalize()` is called with `count < 3`.

---

## 🧪 Testing Tips

* Always initialize the account before interacting.
* You can simulate multiple users by switching wallets when calling `increment` and `decrement`.
* Use `finalize()` to clean up after your test runs to avoid rent charges.

---

## 🏗️ Built With

* [Solana](https://solana.com/)
* [Anchor Framework](https://book.anchor-lang.com/)
* [TypeScript client (via Anchor)](https://docs.rs/anchor-client/latest/anchor_client/)

---

## 📝 License

MIT — feel free to fork and modify.