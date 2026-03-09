# Signatures

Up until this point, we've abstracted away most of the details behind bitcoin **signatures**. Before digging into Lightning, it's important to do a brief review of how signatures work, as they play an important role in creating a trustless off-chain payment system.

## An Analogy
In the old days, people used to write "checks" to send others money. Each check would include the date, recipient, amount, an optional memo, and a **signature**. The signature was meant to act as authorization that the sender is permitting their bank to transfer funds on their behalf.
<p align="center" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/check.png" alt="check" width="70%" height="auto">
</p>

#### Question: How can checks be compromised? How do digital signatures, which Bitcoin uses, add additional security?
<details>
  <summary>Answer</summary>

The major issue with written checks is that they can be forged. In other words, someone can fake your signature and then fradulently claim your funds. Additionally, even if the signature is real, there is no guarentee that the recipient does not try to alter it. For instance, by changing the amount of money you're sending them.

Bitcoin makes a massive improvement on this "technology" by leveraging **digital signatures**. As we'll soon see, digital signatures are uniquely tied to the "check" or data they are signing. Also, it's impossible to forge a signature unless you know the private key itself!

</details>

## Bitcoin Signatures

In Bitcoin, **signatures** are used to accomplish the following two goals:
1) Prove that you know the **secret key** to a corresponding **public key**.
2) **Bind itself** to specific information - a unique bitcoin transaction. This ensure that the signature is only valid for the given transaction, and it cannot be reused for another transaction.

## Creating a Signature
To create a signature, you need to *sign* a **message** using your private key. In Bitcoin, the message is the **transaction data**, but cryptographic signing can be leveraged for many things.

For example, in the below diagram, you'll see that we first create a version of our transaction without a signature. This is used as our **message**, which we sign with our private key. Once we sign the message, we create a digital signature which is bound to the exact transaction we signed, meaning it cannot be used for any other transactions. In reality, the Elliptic Curve Digital Signature Algorithm is more complicated than this, and I encourage you to check out [Learn Me A Bitcoin's educational resource](https://learnmeabitcoin.com/technical/cryptography/elliptic-curve/ecdsa/) if you're intersted in learning more!

<p align="center" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/sign.png" alt="sign" width="100%" height="auto">
</p>

An important note to emphasise - we must create a signature ***for each input*** that we'd like to spend.

## Verifying a Signature
To verify a signature, we must have the following pieces of information:
- The **message** that was used to produce the signature.
- The **signature** itself.
- The **public key** corresponding to the *private key* that was used to create this messsage.

Then, by leveraging elliptic curve mathematics, we can do some advanced calculations to verify the following:
1) The person who created the signature knows the private key corresponding to the given public key.
2) The message itself has not changed in any meaningful way.

<p align="center" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/verify.png" alt="verify" width="100%" height="auto">
</p>

## Signature Types
In Bitcoin, we can specify which parts of the transaction we're signing by adjusting the transaction data before passing it into the signing algorithm. This adds additional flexibility and capabilities, as participants can provide signatures to some parts of transactions, but not all.

To inform the Bitcoin protocol which parts of the transaction are being signed, we use a special **signature hash type** (also known as **sighash**) flag in our transaction. We do this by appending a **1-byte** sighash to the signature before including it in the transaction.

Below are the sighash options:

```
0x01 = SIGHASH_ALL
0x02 = SIGHASH_NONE
0x03 = SIGHASH_SINGLE
0x81 = SIGHASH_ALL | SIGHASH_ANYONECANPAY
0x82 = SIGHASH_NONE | SIGHASH_ANYONECANPAY
0x83 = SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
```

We'll breifly discuss each of them below. When reviewing them, imagine we are spending the first input.

<p align="left" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/input.png" alt="input" width="30%" height="auto">
</p>


### SIGHASH_ALL & SIGHASH_ALL | SIGHASH_ANYONECANPAY
- The `SIGHASH_ALL` flag indicates that we signed **all of the inputs and outputs**. This is the default in many wallet software, as it ensures that the signature is only valid if the transaction is not changed.
- If `SIGHASH_ANYONECANPAY` is used in conjunction with the `SIGHASH_ALL` flag, then we are signaling that we signed **all of the ouputs** and **the one input** that this signature is created for. Therefore, others are free to add inputs to this transaction, as long as the outputs remain unchanged. 
<p align="center" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/sighash_all.png" alt="sighash_all" width="90%" height="auto">
</p>

### SIGHASH_NONE & SIGHASH_NONE | SIGHASH_ANYONECANPAY
- The `SIGHASH_NONE` flag indicates that we signed **all of the inputs and** ***none*** **of the outputs**. Since you're not binding your signature to any outputs, you're effectively allowing anyone to add whichever outputs they please, regardless of whom they spend to!
- If `SIGHASH_ANYONECANPAY` is used in conjunction with the `SIGHASH_NONE` flag, then we are signaling that, for the given input we are seeking to spend, we **only signed the input**. 
<p align="center" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/sighash_none.png" alt="sighash_none" width="90%" height="auto">
</p>

### SIGHASH_SINGLE & SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
- The `SIGHASH_SINGLE` flag indicates that we signed **all of the inputs and** ***one*** **of the outputs** - the one output is the one that corresponds to the index of the input we're creating a signature for.
- If `SIGHASH_ANYONECANPAY` is used in conjunction with the `SIGHASH_SINGLE` flag, then we are signaling that, for the given input, we **only signed the input and the corresponding output**. This is useful if we want to allow *others* to replace by fee (RBF) our transaction with another one, as they would be able to attach their own inputs and outputs to the transaction in such a way that our signature is still valid.
<p align="center" style="width: 50%; max-width: 300px;">
  <img src="./tutorial_images/sighash_single.png" alt="sighash_single" width="90%" height="auto">
</p>


## ⚡️ Write A Function To Generate A P2WPKH Signature

For this exercise, we'll complete the function `generate_p2wpkh_signature`, which will create a signature for a Pay-To-Witness-Public-Key-Hash output. It will return a `Signature` type, which is defined in **rust-bitcoin**. You can read more about it [here](https://docs.rs/secp256k1/latest/secp256k1/ecdsa/struct.Signature.html).

```rust 
pub fn generate_p2wpkh_signature(
    transaction: Transaction,
    input_idx: usize,
    script: &ScriptBuf,
    amount: Amount,
    sighash_type: EcdsaSighashType,
    private_key: SecretKey,
) -> Signature {
    let secp = Secp256k1::new();

    let mut cache = SighashCache::new(&transaction);

    let sighash = cache
        .p2wpkh_signature_hash(input_idx, &script, amount, sighash_type)
        .unwrap();

    let message = Message::from(sighash);

    let signature = secp.sign_ecdsa(&message, &private_key);

    signature
}

pub fn generate_p2wpkh_signature(
    transaction: Transaction,
    input_idx: usize,
    script: &ScriptBuf,
    amount: Amount,
    sighash_type: EcdsaSighashType,
    private_key: SecretKey,
) -> Signature {
  // Step 1: Initialize the Secp256k1 Context
  let secp = Secp256k1::new();

  // Step 2: Create a Sighash Cache

  // Step 3: Compute the P2WPKH Signature Hash

  // Step 4: Create the Message

  // Step 5: Generate and Return the ECDSA Signature
  
}
```

<details>
  <summary>Step 1: Initialize the Secp256k1 Context</summary>

Create a new Secp256k1 context for cryptographic operations.

```rust
let secp = Secp256k1::new();
```
- `Secp256k1::new()` initializes a new Secp256k1 context, which is required for signing operations.

</details>

<details>
  <summary>Step 2: Create a Sighash Cache</summary>

Initialize a `SighashCache` for the transaction to efficiently compute the signature hash.

```rust
let mut cache = SighashCache::new(&transaction);
```

- SighashCache::new(&transaction) creates a cache to store intermediate data for signature hash computation.

</details>


<details>
  <summary>Step 3: Compute the P2WPKH Signature Hash</summary>

Calculate the P2WPKH signature hash for the specified input using the provided script, amount, and sighash type.

```rust
let sighash = cache
    .p2wpkh_signature_hash(input_idx, &script, amount, sighash_type)
    .unwrap();
```
- `cache.p2wpkh_signature_hash(...)` computes the signature hash for the input at input_idx as per BIP-143.
- Parameters include the `script` (scriptPubKey of the output being spent), `amount` (value of the output), and `sighash_type` (e.g., SIGHASH_ALL).
- `.unwrap()` assumes the computation succeeds; in production, you may want to handle errors gracefully.

</details>

<details>
  <summary>Step 4: Create the Message</summary>

Convert the signature hash into a `Message` type suitable for ECDSA signing.

```rust
let message = Message::from(sighash);
```
- `Message::from(sighash)` creates a `secp256k1::Message` from the computed signature hash.
This prepares the hash for signing with the private key.

</details>


<details>
  <summary>Step 5: Generate and Return the ECDSA Signature</summary>

Sign the message using the provided private key and return the resulting ECDSA signature.

```rust
let signature = secp.sign_ecdsa(&message, &private_key);
```
- secp.sign_ecdsa(&message, &private_key) generates an ECDSA signature using the Secp256k1 context.

</details>
