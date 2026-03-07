import type { ScriptPath } from "./types";

// The offered HTLC script from BOLT 3, split into individual lines.
// Line indices are referenced by ExecutionStep.scriptLine.
const OFFERED_HTLC_SCRIPT: string[] = [
  "# To remote node with revocation key",                // 0
  "OP_DUP",                                               // 1
  "OP_HASH160",                                           // 2
  "<RIPEMD160(SHA256(revocationpubkey))>",                // 3
  "OP_EQUAL",                                              // 4
  "OP_IF",                                                 // 5
  "    OP_CHECKSIG",                                       // 6
  "OP_ELSE",                                               // 7
  "    <remote_htlcpubkey>",                               // 8
  "    OP_SWAP",                                           // 9
  "    OP_SIZE",                                           // 10
  "    32",                                                // 11
  "    OP_EQUAL",                                          // 12
  "    OP_NOTIF",                                          // 13
  "        # Timeout path (no preimage)",                  // 14
  "        OP_DROP",                                       // 15
  "        2",                                             // 16
  "        OP_SWAP",                                       // 17
  "        <local_htlcpubkey>",                            // 18
  "        2",                                             // 19
  "        OP_CHECKMULTISIG",                              // 20
  "    OP_ELSE",                                           // 21
  "        # Preimage path (has preimage)",                // 22
  "        OP_HASH160",                                    // 23
  "        <RIPEMD160(payment_hash)>",                     // 24
  "        OP_EQUALVERIFY",                                // 25
  "        2",                                             // 26
  "        OP_SWAP",                                       // 27
  "        <local_htlcpubkey>",                            // 28
  "        2",                                             // 29
  "        OP_CHECKMULTISIG",                              // 30
  "    OP_ENDIF",                                          // 31
  "OP_ENDIF",                                              // 32
];

// ===========================
// TIMEOUT PATH
// ===========================
// Witness: 0 <sig_remote> <sig_local> <>
// The empty item <> fails the revocation check, then OP_SIZE pushes 0,
// which fails the 32-byte check, so OP_NOTIF takes the timeout branch.
// OP_CHECKMULTISIG verifies both signatures.

export const TIMEOUT_PATH: ScriptPath = {
  name: "HTLC Timeout Path",
  description: "The witness [0, <sig_remote>, <sig_local>, <>] provides an empty item that fails the revocation check, then fails the 32-byte size check, entering the timeout branch where both signatures are verified.",
  witnessItems: [
    { label: "0", color: "gray" },
    { label: "<sig_remote>", color: "blue" },
    { label: "<sig_local>", color: "blue" },
    { label: "<>", color: "gray" },
  ],
  scriptLines: OFFERED_HTLC_SCRIPT,
  steps: [
    // Step 0: Initial state. Witness items are pushed onto the stack.
    {
      scriptLine: 0,
      opcode: "WITNESS",
      action: "Witness items are pushed onto the stack. The top item (<>) will be checked against the revocation key hash first.",
      stackBefore: [],
      stackAfter: [
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 1: OP_DUP duplicates the top stack item
    {
      scriptLine: 1,
      opcode: "OP_DUP",
      action: "OP_DUP duplicates the top stack item. Now there are two copies of <> on top.",
      stackBefore: [
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<>", color: "gray" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 2: OP_HASH160 hashes the top item
    {
      scriptLine: 2,
      opcode: "OP_HASH160",
      action: "OP_HASH160 pops the top item and pushes its RIPEMD160(SHA256()) hash. The empty value hashes to a known constant.",
      stackBefore: [
        { value: "<>", color: "gray" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<hash_of_empty>", color: "purple" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 3: Push the revocation pubkey hash
    {
      scriptLine: 3,
      opcode: "DATA",
      action: "The script pushes the expected revocation pubkey hash onto the stack for comparison.",
      stackBefore: [
        { value: "<hash_of_empty>", color: "purple" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<revocation_hash>", color: "green" },
        { value: "<hash_of_empty>", color: "purple" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 4: OP_EQUAL compares top two items
    {
      scriptLine: 4,
      opcode: "OP_EQUAL",
      action: "OP_EQUAL pops two items and compares them. <hash_of_empty> does not equal <revocation_hash>, so it pushes false (0).",
      stackBefore: [
        { value: "<revocation_hash>", color: "green" },
        { value: "<hash_of_empty>", color: "purple" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "false", color: "gold" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 5: OP_IF evaluates, takes ELSE branch
    {
      scriptLine: 5,
      opcode: "OP_IF",
      action: "OP_IF pops the top value. Since it is false, execution skips the IF body and jumps to the ELSE branch (line 7).",
      stackBefore: [
        { value: "false", color: "gold" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      branchTaken: "ELSE",
      skipLines: [6],
    },
    // Step 6: Push <remote_htlcpubkey>
    {
      scriptLine: 8,
      opcode: "DATA",
      action: "The script pushes <remote_htlcpubkey> onto the stack. This key will be used later for the multisig check.",
      stackBefore: [
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 7: OP_SWAP
    {
      scriptLine: 9,
      opcode: "OP_SWAP",
      action: "OP_SWAP swaps the top two stack items, putting <> on top and <remote_htlcpubkey> below it.",
      stackBefore: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<>", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 8: OP_SIZE
    {
      scriptLine: 10,
      opcode: "OP_SIZE",
      action: "OP_SIZE pushes the byte length of the top item without removing it. The empty value <> has size 0.",
      stackBefore: [
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "0", color: "gray" },
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 9: Push 32
    {
      scriptLine: 11,
      opcode: "DATA",
      action: "The script pushes the number 32 onto the stack. This is the expected size of a valid preimage (32 bytes).",
      stackBefore: [
        { value: "0", color: "gray" },
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "32", color: "gray" },
        { value: "0", color: "gray" },
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 10: OP_EQUAL (size check)
    {
      scriptLine: 12,
      opcode: "OP_EQUAL",
      action: "OP_EQUAL compares 0 and 32. They are not equal, so it pushes false. This means the witness did not provide a 32-byte preimage.",
      stackBefore: [
        { value: "32", color: "gray" },
        { value: "0", color: "gray" },
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "false", color: "gold" },
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 11: OP_NOTIF (inverts the condition)
    {
      scriptLine: 13,
      opcode: "OP_NOTIF",
      action: "OP_NOTIF pops the top value and inverts it. Since the top is false, NOT(false) = true, so we enter the timeout branch.",
      stackBefore: [
        { value: "false", color: "gold" },
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      branchTaken: "IF",
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 12: OP_DROP
    {
      scriptLine: 15,
      opcode: "OP_DROP",
      action: "OP_DROP removes the top stack item (<>). It was only needed for the size check and is no longer useful.",
      stackBefore: [
        { value: "<>", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 13: Push 2
    {
      scriptLine: 16,
      opcode: "DATA",
      action: "The script pushes 2 onto the stack. This is the threshold for the 2-of-2 multisig (OP_CHECKMULTISIG needs to know how many signatures are required).",
      stackBefore: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "2", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 14: OP_SWAP
    {
      scriptLine: 17,
      opcode: "OP_SWAP",
      action: "OP_SWAP swaps the top two items, putting <remote_htlcpubkey> above 2. This arranges the stack so the public keys are grouped together for the multisig.",
      stackBefore: [
        { value: "2", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 15: Push <local_htlcpubkey>
    {
      scriptLine: 18,
      opcode: "DATA",
      action: "The script pushes <local_htlcpubkey> onto the stack. Now both public keys for the 2-of-2 multisig are on the stack.",
      stackBefore: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 16: Push 2 (key count)
    {
      scriptLine: 19,
      opcode: "DATA",
      action: "The script pushes 2 as the total number of public keys. The stack now has: 2 keys, 2 (key count), signatures, and the dummy 0.",
      stackBefore: [
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "2", color: "gray" },
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 17: OP_CHECKMULTISIG
    {
      scriptLine: 20,
      opcode: "OP_CHECKMULTISIG",
      action: "OP_CHECKMULTISIG pops the key count (2), both pubkeys, the sig count (2), both signatures, and the dummy 0. It verifies 2-of-2 and pushes true. The HTLC has been spent via the timeout path.",
      stackBefore: [
        { value: "2", color: "gray" },
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
      ],
      consumed: 0,
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 18: OP_ENDIF (inner)
    {
      scriptLine: 31,
      opcode: "OP_ENDIF",
      action: "OP_ENDIF closes the inner OP_NOTIF/OP_ELSE block. No stack changes.",
      stackBefore: [
        { value: "true", color: "gold" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
      ],
      consumed: 0,
      branchTaken: "ENDIF",
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    // Step 19: OP_ENDIF (outer)
    {
      scriptLine: 32,
      opcode: "OP_ENDIF",
      action: "OP_ENDIF closes the outer OP_IF/OP_ELSE block. The stack has true on top, so the script succeeds. The HTLC timeout spending is valid.",
      stackBefore: [
        { value: "true", color: "gold" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
      ],
      consumed: 0,
      branchTaken: "ENDIF",
      skipLines: [6, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
  ],
};


// ===========================
// PREIMAGE PATH
// ===========================
// Witness: 0 <sig_remote> <sig_local> <payment_preimage>
// The preimage fails the revocation check, then OP_SIZE pushes 32,
// which passes the 32-byte check, so OP_NOTIF skips to ELSE (preimage branch).
// OP_HASH160 hashes the preimage, OP_EQUALVERIFY checks against payment hash,
// then OP_CHECKMULTISIG verifies both signatures.

export const PREIMAGE_PATH: ScriptPath = {
  name: "HTLC Preimage Path",
  description: "The witness [0, <sig_remote>, <sig_local>, <payment_preimage>] provides the preimage which also fails the revocation check, but passes the 32-byte size check, entering the preimage branch where the hash is verified and both signatures are checked.",
  witnessItems: [
    { label: "0", color: "gray" },
    { label: "<sig_remote>", color: "blue" },
    { label: "<sig_local>", color: "blue" },
    { label: "<payment_preimage>", color: "purple" },
  ],
  scriptLines: OFFERED_HTLC_SCRIPT,
  steps: [
    // Step 0: Witness items pushed
    {
      scriptLine: 0,
      opcode: "WITNESS",
      action: "Witness items are pushed onto the stack. The top item (<payment_preimage>) will be checked against the revocation key hash first.",
      stackBefore: [],
      stackAfter: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 1: OP_DUP
    {
      scriptLine: 1,
      opcode: "OP_DUP",
      action: "OP_DUP duplicates the top stack item. Now there are two copies of <payment_preimage> on top.",
      stackBefore: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 2: OP_HASH160
    {
      scriptLine: 2,
      opcode: "OP_HASH160",
      action: "OP_HASH160 pops the top item and pushes its RIPEMD160(SHA256()) hash. The preimage hashes to a value that will NOT match the revocation pubkey hash.",
      stackBefore: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<hash_of_preimage>", color: "purple" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 3: Push revocation hash
    {
      scriptLine: 3,
      opcode: "DATA",
      action: "The script pushes the expected revocation pubkey hash onto the stack for comparison.",
      stackBefore: [
        { value: "<hash_of_preimage>", color: "purple" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<revocation_hash>", color: "green" },
        { value: "<hash_of_preimage>", color: "purple" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 4: OP_EQUAL
    {
      scriptLine: 4,
      opcode: "OP_EQUAL",
      action: "OP_EQUAL compares the two hashes. The preimage hash does not equal the revocation pubkey hash, so it pushes false (0).",
      stackBefore: [
        { value: "<revocation_hash>", color: "green" },
        { value: "<hash_of_preimage>", color: "purple" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "false", color: "gold" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
    },
    // Step 5: OP_IF (takes ELSE)
    {
      scriptLine: 5,
      opcode: "OP_IF",
      action: "OP_IF pops the top value. Since it is false, execution skips the IF body and jumps to the ELSE branch (line 7).",
      stackBefore: [
        { value: "false", color: "gold" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      branchTaken: "ELSE",
      skipLines: [6],
    },
    // Step 6: Push <remote_htlcpubkey>
    {
      scriptLine: 8,
      opcode: "DATA",
      action: "The script pushes <remote_htlcpubkey> onto the stack for later use in the multisig check.",
      stackBefore: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 7: OP_SWAP
    {
      scriptLine: 9,
      opcode: "OP_SWAP",
      action: "OP_SWAP swaps the top two stack items, putting <payment_preimage> on top and <remote_htlcpubkey> below.",
      stackBefore: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 8: OP_SIZE
    {
      scriptLine: 10,
      opcode: "OP_SIZE",
      action: "OP_SIZE pushes the byte length of the top item without removing it. The preimage is 32 bytes long.",
      stackBefore: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "32", color: "gray" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 9: Push 32
    {
      scriptLine: 11,
      opcode: "DATA",
      action: "The script pushes the number 32. This is the expected length for a valid preimage.",
      stackBefore: [
        { value: "32", color: "gray" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "32", color: "gray" },
        { value: "32", color: "gray" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 10: OP_EQUAL (size check)
    {
      scriptLine: 12,
      opcode: "OP_EQUAL",
      action: "OP_EQUAL compares 32 and 32. They match, so it pushes true. The witness item is a valid 32-byte preimage.",
      stackBefore: [
        { value: "32", color: "gray" },
        { value: "32", color: "gray" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6],
    },
    // Step 11: OP_NOTIF (skips to ELSE, i.e. preimage branch)
    {
      scriptLine: 13,
      opcode: "OP_NOTIF",
      action: "OP_NOTIF pops the top value and inverts it. Since the top is true, NOT(true) = false, so we skip the NOTIF body and jump to the ELSE (preimage) branch.",
      stackBefore: [
        { value: "true", color: "gold" },
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      branchTaken: "ELSE",
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 12: OP_HASH160 (hash the preimage)
    {
      scriptLine: 23,
      opcode: "OP_HASH160",
      action: "OP_HASH160 pops the preimage and pushes RIPEMD160(SHA256(preimage)). This is the hash that must match the payment hash.",
      stackBefore: [
        { value: "<payment_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<hashed_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 13: Push payment hash
    {
      scriptLine: 24,
      opcode: "DATA",
      action: "The script pushes the expected payment hash. If the preimage is correct, its hash will match this value.",
      stackBefore: [
        { value: "<hashed_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<payment_hash>", color: "purple" },
        { value: "<hashed_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 14: OP_EQUALVERIFY
    {
      scriptLine: 25,
      opcode: "OP_EQUALVERIFY",
      action: "OP_EQUALVERIFY pops two items and checks equality. The hashed preimage matches the payment hash, so execution continues. (If they did not match, the script would fail immediately.)",
      stackBefore: [
        { value: "<payment_hash>", color: "purple" },
        { value: "<hashed_preimage>", color: "purple" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 15: Push 2
    {
      scriptLine: 26,
      opcode: "DATA",
      action: "The script pushes 2 onto the stack as the signature threshold for the 2-of-2 multisig.",
      stackBefore: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "2", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 16: OP_SWAP
    {
      scriptLine: 27,
      opcode: "OP_SWAP",
      action: "OP_SWAP swaps the top two items, putting <remote_htlcpubkey> above 2 to group the public keys together for multisig.",
      stackBefore: [
        { value: "2", color: "gray" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 17: Push <local_htlcpubkey>
    {
      scriptLine: 28,
      opcode: "DATA",
      action: "The script pushes <local_htlcpubkey> onto the stack. Both public keys for the 2-of-2 multisig are now present.",
      stackBefore: [
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 18: Push 2 (key count)
    {
      scriptLine: 29,
      opcode: "DATA",
      action: "The script pushes 2 as the total number of public keys for the multisig.",
      stackBefore: [
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "2", color: "gray" },
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 19: OP_CHECKMULTISIG
    {
      scriptLine: 30,
      opcode: "OP_CHECKMULTISIG",
      action: "OP_CHECKMULTISIG pops the key count (2), both pubkeys, the sig count (2), both signatures, and the dummy 0. It verifies 2-of-2 and pushes true. The HTLC has been spent via the preimage path, proving knowledge of the payment secret.",
      stackBefore: [
        { value: "2", color: "gray" },
        { value: "<local_htlcpubkey>", color: "green" },
        { value: "<remote_htlcpubkey>", color: "green" },
        { value: "2", color: "gray" },
        { value: "<sig_local>", color: "blue" },
        { value: "<sig_remote>", color: "blue" },
        { value: "0", color: "gray" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
      ],
      consumed: 0,
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 20: OP_ENDIF (inner)
    {
      scriptLine: 31,
      opcode: "OP_ENDIF",
      action: "OP_ENDIF closes the inner OP_NOTIF/OP_ELSE block. No stack changes.",
      stackBefore: [
        { value: "true", color: "gold" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
      ],
      consumed: 0,
      branchTaken: "ENDIF",
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
    // Step 21: OP_ENDIF (outer)
    {
      scriptLine: 32,
      opcode: "OP_ENDIF",
      action: "OP_ENDIF closes the outer OP_IF/OP_ELSE block. The stack has true on top, so the script succeeds. The HTLC preimage spending is valid.",
      stackBefore: [
        { value: "true", color: "gold" },
      ],
      stackAfter: [
        { value: "true", color: "gold" },
      ],
      consumed: 0,
      branchTaken: "ENDIF",
      skipLines: [6, 14, 15, 16, 17, 18, 19, 20],
    },
  ],
};
