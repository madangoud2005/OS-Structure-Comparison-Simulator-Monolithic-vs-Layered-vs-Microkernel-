# OS Structure Comparison Simulator: Monolithic vs Layered vs Microkernel Simulator

> An abstract, conceptual, and interactive Operating Systems laboratory simulator demonstrating how **ONE system call** journeys through three distinct OS architectures: **Monolithic**, **Layered**, and **Microkernel**.

---

## 🌟 Overview

In modern computer science education, students often struggle to visualize the concrete low-level costs and trade-offs between operating system kernel designs. Concepts like **privilege mode switches (Ring 3 &harr; Ring 0)**, **process context switches (CR3 reloads & TLB flushes)**, **in-kernel function calls vs. IPC message copies**, and **fault containment** are discussed in textbooks but rarely experienced interactively.

**OS Structure Lab** solves this through a clean, abstract, and concept-focused visualization. Components are rendered as rounded glassmorphism nodes connected by glowing animated lines, with a radiant **Request Orb** tracing the execution path from node to node, accompanied by a live hardware register inspector and mathematical cost model.

---

## 📸 Visual Walkthrough & Screenshots

```
+---------------------------------------------------------------------------------------------------------+
| [Logo] OS Structure Lab      [Monolithic] [Layered] [Microkernel] [⚡ Compare All]       [Theory] [Tour] [Export] |
+------------------------+------------------------------------------------------+-------------------------+
| SELECT SYSTEM CALL     | CENTER STAGE (Abstract SVG Visual Canvas)            | CURRENT STAGE EXPLAINER |
| [•] read()             |                                                      | STAGE 3 OF 7 [Kernel]   |
| [ ] write()            |   [User Application (Ring 3)]                        | File System Resolution  |
| [ ] open()             |                │                                     | Direct in-memory C call |
| [ ] fork()             |                ▼ (Syscall Trap Gate)                 +-------------------------+
| [ ] send_message()     |   [================ Kernel (Ring 0) ===============]  | HARDWARE & PROCESS      |
|                        |   │ [VFS & POSIX] ➔ [Ext4 FS] ➔ [Storage Driver]   │  | CPL: 0 (Supervisor)     |
| FAULT INJECTION        |   [================================================] | RAX: 0x00  RIP: 0x8131  |
| [💥 Crash Driver]      |                │                                     | RSP: 0xffff  CR3: 0x1a  |
| [📁 Crash File System] |                ▼                                     | TLB: HIT   PCB: RUNNING |
| [✓ Clear Faults]       |   [Physical Hardware Controller / DMA Bus]           +-------------------------+
|                        |                                                      | MICRO-OP LOG            |
| ANIMATION SPEED        |   (Glowing Request Orb travels between nodes)        | [T+40ns] syscall        |
| [===●===========] 1.0x |                                                      | [T+80ns] call vfs_read  |
+------------------------+------------------------------------------------------+-------------------------+
| [Back] [Play/Pause] [Next] [Reset]  ●───────●───────●───────○───────○───────○───────○   Stage 3: Ext4 Extents   |
+---------------------------------------------------------------------------------------------------------+
```

### Visual Walkthrough
- **Monolithic Syscall Flow:**  
  ![Monolithic Flow](screenshots/monolithic-flow.png)  
  *User App enters kernel via MSR LSTAR trap gate, traverses VFS, Ext4, and Driver in a single supervisor address space, and returns via SYSRETQ.*
- **Layered OS Flow (Dijkstra THE Architecture):**  
  ![Layered Architecture Flow](screenshots/layered-flow.png)  
  *Request cascades strictly downward through concentric tiers L5 &rarr; L4 &rarr; L3 &rarr; L2 &rarr; L1 &rarr; L0 with +40c per-hop stack overhead, then bubbles back upward.*
- **Microkernel User-Space Daemons & Self-Healing:**  
  ![Microkernel Self-Healing](screenshots/microkernel-self-healing.png)  
  *Isolated File Server and Driver daemons run in Ring 3. On driver failure, the Reincarnation Server transparently restarts the daemon (+1,500c penalty) with 100% OS uptime.*
- **Monolithic Kernel Panic (Crash Driver):**  
  ![Kernel Panic](screenshots/monolithic-kernel-panic.png)  
  *A driver crash in Ring 0 halts the whole monolithic system at the faulting stage.*
- **⚡ Compare All Mode & Real Bar Charts:**  
  ![Compare All Mode](screenshots/compare-mode.png)  
  *Side-by-side synchronized execution race with dynamic pure CSS/SVG comparative metrics and winner badges.*

---

## 🏗️ Architecture Comparison Summary

| Dimension | Monolithic Kernel (Linux, FreeBSD) | Layered OS (Dijkstra THE System) | Microkernel (MINIX 3, QNX, seL4) |
| :--- | :--- | :--- | :--- |
| **Ring 0 Supervisor Footprint** | Massive (Entire OS: VFS, FS, Drivers, Sched, Net) | Moderate to High (All layers below L5 in Ring 0) | Minimal (IPC broker, scheduler, basic VM only; &lt; 10k LOC) |
| **User Space (Ring 3)** | Applications only | Layer 5 Applications only | Applications + File Server + Driver Servers + Network Server |
| **Communication Mechanism** | Direct in-memory C function calls | Strict hierarchical inter-layer API calls | Synchronous/asynchronous capability-based IPC |
| **Privilege Transitions / Syscall** | **2 switches** (1 entry trap, 1 exit return) | **2 switches** (entry & exit) | **8 switches** (4 IPC hops, each crossing Ring 3 &harr; Ring 0 twice) |
| **Context Switches (CR3)** | **0 switches** (Runs in caller thread address space) | **0 switches** | **4 switches** (CR3 reloaded per isolated daemon) |
| **Fault Isolation & Resilience** | **None inside Ring 0** (Driver crash = Kernel Panic) | **Layer boundaries** (Stops lower-layer corruption) | **Complete** (User-space server crashes; Reincarnation Server self-heals) |
| **Performance Overhead** | Minimal latency, maximum I/O throughput | Moderate (Cascading function call stack overhead) | Higher latency due to IPC copies & TLB invalidation |

---

## 📊 Calibrated Cost Model Specification

All simulation metrics (execution cycles, privilege transitions, address space reloads, IPC envelopes, and nodes visited) are computed strictly from a unified, deterministic **single source of truth** cost table:

### Low-Level Cost Constants

| Primitive Operation | Cost (Cycles) | Architectural Description & Hardware Justification |
| :--- | :---: | :--- |
| `APP_PREP` | **15** | Marshaling syscall arguments into general-purpose CPU registers (`RAX`, `RDI`, `RSI`, `RDX`). |
| `SYSCALL_TRAP` | **150** | Hardware `SYSCALL` instruction: loads `IA32_LSTAR` into `RIP`, saves `RIP` to `RCX`, switches CPL from 3 to 0, and swaps stack to kernel `RSP`. |
| `SYSRET` | **150** | Hardware `SYSRETQ` / `IRETQ`: restores user `RSP`, switches CPL from 0 to 3, and returns CPU to user space. |
| `HOP_COST` | **40** | Function call frame push/pop, parameter validation, and register saving at every concentric layered boundary. |
| `CTX_SWITCH` | **900** | Full process context switch: saving thread registers, reloading `CR3` page directory base, and updating scheduler state. |
| `TLB_MISS_FLUSH` | **200** | Non-global TLB invalidation penalty incurred on address space switch, causing 4-level page table walks until working set is re-cached. |
| `IPC_COPY` | **400** | Copying message envelope across user/kernel address space boundaries and validating capability tokens. |
| `DISK_IO` | **500** | Physical hardware controller bus transaction, NVMe DMA transfer, and interrupt dispatch. |
| `VFS_LOOKUP` | **80** | In-kernel VFS path traversal, dentry hash lookup, and process file descriptor resolution (`fget_light`). |
| `FS_INODE_OP` | **110** | File system extent resolution, inode block mapping, or directory scanning. |
| `DRIVER_DISPATCH` | **70** | Driver MMIO register strobe and DMA submission queue entry queueing. |
| `MEM_PAGE_OP` | **130** | Page table walk, page frame allocation, or Copy-On-Write (COW) write-protect bit tagging. |
| `DAEMON_RESTART` | **1,500** | Reincarnation Server crash detection, fork/exec of fresh replacement daemon, capability table update, and client request retry. |

### Derived Cycle Counts Across Architectures (Normal Execution)

Because each syscall executes distinct subsystem operations, execution cycles differ realistically across architectures:

| System Call | Monolithic (Linux) | Layered (THE OS) | Microkernel (MINIX 3) | Microkernel (After Self-Healing) |
| :--- | :---: | :---: | :---: | :---: |
| `read()` | **1,075 c** | **1,485 c** | **7,445 c** | **8,945 c** (+1,500c restart) |
| `write()` | **1,105 c** | **1,555 c** | **7,495 c** | **8,995 c** (+1,500c restart) |
| `open()` | **1,095 c** | **1,475 c** | **7,465 c** | **8,965 c** (+1,500c restart) |
| `fork()` | **1,165 c** | **1,295 c** | **7,385 c** | **8,885 c** (+1,500c restart) |
| `send_message()` | **645 c** | **1,025 c** | **7,015 c** | **8,515 c** (+1,500c restart) |

---

### Fault Behaviour in the Simulator
- **Monolithic / Layered:** the run halts at the first stage that matches the injected fault (kernel panic / layer assertion). Stepping, jumping on the timeline and Compare mode all stop at that stage.
- **Microkernel:** the Reincarnation Server restarts the failed server (+1,500c) and the run completes; the penalty is only added once the faulting stage has been reached.

---

## 🧪 Running the Tests

```bash
npm install playwright          # one-time
node tests/smoke-test.js        # set CHROMIUM_PATH=/path/to/chromium to reuse an existing browser
```
The suite verifies all 15 README cycle counts, ring/context-switch counts, fault injection for every architecture, timeline jumps, Compare mode, keyboard shortcuts, theme toggle, export, responsive overflow, and console errors. It also prints basic load/render timings.

---

## 🚀 Key Features

### 1. Conceptual POSIX System Call Selector
Choose from 5 fundamental operating system calls, each featuring dedicated stage descriptions, micro-ops, state transitions, and register traces:
- `read(fd, buf, count)`: Synchronous storage read, DMA transfer, page cache lookup.
- `write(fd, buf, count)`: Buffer dirtying, journal transaction, device queueing.
- `open(pathname, flags)`: Path resolution, dentry lookup, inode and PCB file descriptor allocation.
- `fork()`: Task struct duplication, address space cloning, Copy-On-Write (COW) page table tagging.
- `send_message(dest_pid, msg)`: Capability token verification and direct message passing.

### 2. Glowing Request Orb & Stage-by-Stage Flow
- **Monolithic**: App &rarr; Trap Gate &rarr; Single Unified Kernel (VFS + Ext4 + Driver in shared address space) &rarr; Hardware &rarr; Return.
- **Layered**: App (L5) &rarr; Syscall Layer (L4) &rarr; File System Layer (L3) &rarr; Memory Layer (L2) &rarr; Driver Layer (L1) &rarr; Hardware (L0), and returns bubbling back up through every layer with per-layer overhead badges (+40c).
- **Microkernel**: App &rarr; Trap &rarr; Microkernel Core (IPC only) &rarr; Flying Amber Envelopes &rarr; File Server (Ring 3) &rarr; Disk Driver Server (Ring 3) &rarr; Hardware &rarr; Return IPC path.
- **⚡ Compare All (3-Way) Mode**: Synchronizes all three architectures side-by-side with animated mini-stages and pure SVG/CSS comparative bar charts with winner badges.

### 3. Live Hardware Registers & PCB State Inspector
Every stage updates real hardware CPU state:
- **CPL**: Current Privilege Level (`Ring 3` User vs. `Ring 0` Supervisor).
- **RAX**: Syscall number on entry (`0x00`, `0x01`, `0x02`, `0x39`, `180`) and return value on exit (`4096`, `1024`, `fd=3`, `child_pid=102`, `0`).
- **RIP & RSP**: Instruction pointer and stack pointer switching between user stack (`0x7fffde20`) and kernel stack (`0xffffc9000010`).
- **CR3 & TLB**: Address space root register (`0x1a00`, `0x2b00`, `0x3c00`) with live TLB status badges (`HIT`, `MISS`, `FLUSH`).
- **Process State**: Active PID and process lifecycle badge (`RUNNING`, `WAITING`, `READY`).

### 4. Micro-Op Log Stream
A scrolling assembly-style terminal accumulates all executed micro-ops (`syscall`, `swapgs`, `call vfs_read`, `mov cr3, rbx`, `sysretq`) with timestamp offsets, allowing students to inspect low-level execution history.

### 5. Fault Injection & Self-Healing Engine
- **Crash Driver**:
  - *Monolithic*: Unhandled null-pointer in Ring 0 halts the entire OS with a fatal **Kernel Panic** banner (0% availability).
  - *Layered*: Layer assertion halts the cascading pipeline.
  - *Microkernel*: Isolated driver server crashes in Ring 3. The **Reincarnation Server (PID 2)** auto-restarts the driver daemon (+1,500 cycles penalty), and the request continues to completion with **100% uptime**.
- **Crash File System**: Simulates filesystem metadata corruption, targeting Ext4 in Monolithic, Layer 3 in Layered, and File Server (PID 10) in Microkernel.

### 6. Real Compare Mode with Dynamic Charts
Evaluates all 3 architectures for the active syscall and active fault. Renders pure CSS/SVG bar charts with real computed numbers for:
- Total Execution Cycles
- Privilege & Context Switches (CR3)
- Fault Survivability Score
- Winner badge per metric with an explanatory "Why" rationale.

### 7. Dynamic Report Export
- **Print / PDF Summary**: Beautiful print layout containing real multi-architecture comparison tables.
- **JSON Telemetry**: Downloadable JSON report containing exact run parameters, hardware register states, and benchmark metrics.

### 8. Accessibility & Modern Polish
- Accessible `<button>` timeline dots with ARIA labels and keyboard navigation.
- Dedicated `:focus-visible` high-contrast outline for keyboard accessibility.
- `@media (prefers-reduced-motion: reduce)` support.
- Auto-opening guided onboarding tour for first-time visitors (persisted via `localStorage`).
- Inline SVG favicon, Open Graph meta tags, and light/dark theme toggle.

---

## 💻 Tech Stack & Zero-Dependency Guarantee

- **HTML5**: Semantic, accessible markup.
- **CSS3**: Modern glassmorphism dark systems dashboard theme, custom CSS properties, responsive flexbox/grid layout, print styles (`@media print`).
- **Vanilla JavaScript (ES6+)**: Clean, modular, self-contained implementation.
- **Zero External Dependencies**: No frameworks (React, Vue, Angular), no build steps (Webpack, Vite), no CDNs, no remote fonts or icons.
- **100% Offline Compatible**: Operates directly by double-clicking `index.html` from local storage (`file:///` protocol) or when deployed statically.

---

## 📂 File Structure

```
os-structure-lab/
├── index.html        # Main HTML layout, modals, control decks, and SVG stages
├── style.css         # Systems engineering dark/light theme, animations, layout
├── script.js         # Modular simulation engine, SVG renderers, UI controller
├── README.md         # Comprehensive documentation & 10-question university viva guide
├── screenshots/      # Real screenshots used in this README
└── tests/
    └── smoke-test.js # Playwright regression suite (cycle table, faults, compare, export, a11y checks)
```

---

## 🏃 How to Run Locally

### Option 1: Direct File Launch (No Setup Required)
Simply double-click `index.html` in Windows Explorer (or open it with any web browser). It runs entirely offline without any server.

### Option 2: Using Node.js or Python Static Server
```bash
# Using Python 3
python -m http.server 8080

# Using Node.js (npx serve)
npx serve .
```
Navigate to `http://localhost:8080` in your browser.

---

## 🌐 How to Deploy to GitHub Pages / Netlify

### Deploying to GitHub Pages
1. Initialize a git repository and commit your files:
   ```bash
   git init
   git add index.html style.css script.js README.md
   git commit -m "Initial commit of OS Structure Lab"
   ```
2. Create a new repository on GitHub (e.g. `os-structure-lab`) and push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/os-structure-lab.git
   git branch -M main
   git push -u origin main
   ```
3. In your GitHub repository, navigate to **Settings &rarr; Pages**.
4. Under **Build and deployment &rarr; Source**, select **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. Within 60 seconds, your simulator will be live at `https://<your-username>.github.io/os-structure-lab/`.

### Deploying to Netlify
- Drag and drop the project folder directly onto [Netlify Drop](https://app.netlify.com/drop).

---

## 🎓 University OS Exam & Viva Voce Q&A (10 Questions & Detailed Answers)

### Q1: What is the primary architectural trade-off between Monolithic and Microkernel operating systems?
**Answer:** The primary trade-off is **raw performance vs. fault isolation & security**:
- **Monolithic Kernels** optimize for execution speed and low latency. Because all core operating system subsystems (virtual memory, file systems, device drivers, network stacks) execute in supervisor mode (Ring 0) sharing a single unified address space, interactions between subsystems occur via direct, in-memory C function calls with zero IPC or context switch overhead. However, any software bug or memory corruption in any driver crashes the entire system (Kernel Panic).
- **Microkernels** optimize for security, modularity, and fault resilience. By stripping Ring 0 down to minimal primitives (IPC, low-level scheduling, hardware interrupt handling) and running device drivers and file systems as isolated user-mode processes (Ring 3), a crash in a driver is contained to that process alone. The trade-off is substantial performance overhead resulting from multiple privilege mode switches, process context switches, TLB invalidation, and data copies across message queues.

### Q2: Why did first-generation microkernels (e.g. Mach 3.0) suffer from severe performance degradation, and how did second-generation microkernels (e.g. L4, seL4) overcome this?
**Answer:** First-generation microkernels suffered from excessive latency because early designers treated IPC as a generic, complex abstraction. A single client I/O request required 8 or more privilege mode transitions, multiple reloads of the page directory base register (`CR3`), extensive cache line invalidation, and multi-copy message queuing.
Jochen Liedtke's second-generation **L4 microkernel** revolutionized microkernel design through two core principles:
1. *A concept is tolerated in the kernel only if moving it outside would prevent the implementation of the system's required functionality.*
2. IPC was radically optimized: short messages are passed directly through CPU general-purpose registers (zero memory copy), scheduling is combined with IPC handover in a single cycle, and the kernel footprint is minimized so its entire code and data structure fit within CPU L1 cache.

### Q3: Exactly what happens at the hardware register level during an x86_64 `SYSCALL` instruction?
**Answer:** When an unprivileged user-mode application executes `SYSCALL`:
1. The hardware saves the address of the next instruction (in `RIP`) into register `RCX`.
2. The current processor flags register `RFLAGS` is saved into register `R11`.
3. The processor masks `RFLAGS` using the model-specific register `IA32_FMASK` (typically disabling hardware interrupts).
4. The hardware loads the kernel entry-point address from model-specific register `IA32_LSTAR` into `RIP`.
5. The CPU switches the Current Privilege Level (CPL) field in the Code Segment (`CS`) selector from 3 (User) to 0 (Supervisor).
6. The kernel code at the entry point executes `swapgs` to switch the user `GS` base pointer to the per-CPU kernel data area, and swaps the user stack pointer `RSP` to the dedicated kernel stack.

### Q4: Why does a driver crash cause a Kernel Panic in a Monolithic OS, whereas a Microkernel can self-heal with zero downtime?
**Answer:** In a **Monolithic OS**, device drivers are loaded into the same privileged address space as the kernel core (Ring 0). A driver null-pointer dereference or array out-of-bounds write occurs with full supervisor capabilities. If an unhandled page fault occurs in Ring 0, the CPU cannot safely resume because kernel invariants and memory structures may be corrupted; therefore, the kernel halts the CPU with a `Kernel Panic` or `Blue Screen of Death (BSOD)`.
In a **Microkernel** (such as MINIX 3), device drivers execute as unprivileged processes in Ring 3 with their own private page tables (`CR3`). If the driver crashes, the hardware memory management unit (MMU) catches the violation and terminates only that process with a standard `SIGSEGV`. The microkernel and all other servers continue running unimpeded. A monitoring process (the **Reincarnation Server**) detects driver failure via heartbeat timeouts, allocates a new process slot, spawns a fresh copy of the driver daemon, updates IPC capability routing tables, and instructs clients to retry their requests.

### Q5: What is the role of the TLB (Translation Lookaside Buffer), and why does context switching impose a major performance penalty?
**Answer:** The TLB is an on-chip associative cache that stores recently resolved Virtual Page Number (VPN) to Physical Frame Number (PFN) translations. Virtual address translation on modern 64-bit architectures requires a 4-level page table walk (`PML4` &rarr; `PDPT` &rarr; `PD` &rarr; `PT`), which can consume 100 to 200 CPU cycles on a TLB miss.
During a traditional process context switch, changing to another process requires loading a new address space pointer into `CR3`. Because the old virtual address mappings are invalid in the new address space, the CPU hardware invalidates (flushes) all non-global TLB entries. Consequently, following every context switch, the CPU experiences a wave of TLB misses until the working set is re-cached. Modern architectures mitigate this using **PCID (Process-Context Identifiers)** on x86_64 and **ASID** on ARM, which tag TLB entries with process IDs so translations survive context switches without being flushed.

### Q6: Why are pure Layered operating systems (such as Dijkstra's THE Multiprogramming System) rarely used in general-purpose computing today?
**Answer:** Pure layered architectures enforce a strict unidirectional hierarchy: Layer N may only invoke the services of Layer N-1, and higher layers are completely invisible to lower layers. While this provides elegant modularity and simplified formal verification, it suffers from two fatal practical flaws:
1. **Circular Subsystem Dependencies:** Real-world OS components are rarely cleanly ordered. For example, a virtual memory paging subsystem requires a backing-store disk driver to page memory to disk, but the disk driver requires memory buffers and DMA address translations allocated by the virtual memory subsystem.
2. **Cumulative Invocation Overhead:** Every user request must traverse all intermediate layers sequentially, adding function call frame overhead, stack pointer adjustments, and register saving at every boundary.

### Q7: What is a Hybrid Kernel, and why do Windows NT and macOS XNU adopt this architecture?
**Answer:** A **Hybrid Kernel** merges the architectural modularity and abstraction of microkernels with the performance characteristics of monolithic kernels.
- **Windows NT** was originally designed with microkernel principles, featuring user-mode environment subsystems (Win32, POSIX, OS/2) communicating via Local Procedure Calls (LPC). However, in Windows NT 4.0, Microsoft moved the Window Manager, Graphics Device Interface (GDI), and display drivers from user mode into Ring 0 (`win32k.sys`) to eliminate the crippling context switch overhead of drawing desktop graphics.
- **macOS XNU** combines the Mach microkernel (for IPC, threads, and tasks) with a major portion of the monolithic FreeBSD kernel (for POSIX APIs, networking, and VFS), compiled together into a single supervisor address space in Ring 0.

### Q8: How does IPC in a Microkernel fundamentally differ from UNIX Domain Sockets or Pipes in a Monolithic Kernel?
**Answer:** In a **Monolithic Kernel**, pipes, UNIX domain sockets, and message queues are secondary convenience APIs implemented inside kernel memory. Transferring data involves copying from the sender's user-space buffer into a kernel ring buffer, and then into the receiver's user-space buffer, requiring only 2 mode switches.
In a **Microkernel**, IPC is the foundational scheduling and architectural primitive of the entire OS. IPC is typically synchronous (rendezvous-based): when a sender transmits a message, it blocks until the receiver is ready. The microkernel directly pairs the sender and receiver threads, validates capability tokens, copies data directly or maps page frames between their respective address spaces, and immediately dispatches the CPU timeslice to the receiver thread.

### Q9: Summarize the famous Tanenbaum-Torvalds Debate of 1992. What was the core argument, and how did history evaluate it?
**Answer:** On January 29, 1992, Prof. Andrew Tanenbaum (creator of MINIX) posted on Usenet that *“Linux is obsolete”* because it was designed as a monolithic kernel, arguing that microkernels represented the modern consensus of operating systems theory. Linus Torvalds countered that while microkernels might be theoretically cleaner, monolithic kernels were vastly superior in practical performance, simpler to implement, and avoided the complex distributed-system synchronization problems inherent to multi-server microkernels.
**Historical Evaluation:**
Both were proven correct in their respective domains. For general-purpose desktop, cloud, and mobile computing (Linux, Android, Windows, macOS), monolithic and hybrid architectures dominate due to raw I/O throughput. However, for mission-critical, high-assurance, and safety-certified systems where a kernel crash is unacceptable (automotive infotainment and ADAS running QNX, medical devices, space avionics, and verified defense systems using seL4), microkernels have completely triumphed.

### Q10: What are the security implications of Ring 0 privilege escalation, and how do Microkernels limit the attack surface?
**Answer:** In an x86 CPU, supervisor mode (Ring 0) provides unrestricted access to all CPU instructions, physical memory, and I/O ports. In a monolithic kernel with tens of millions of lines of code (Linux is &gt; 30 million LOC), device drivers account for over 70% of the codebase. A buffer overflow or vulnerability in a third-party USB, Wi-Fi, or graphics driver grants an attacker full Ring 0 control of the entire machine, allowing them to bypass access controls, disable security modules (SELinux), and inspect all physical RAM.
In a microkernel, the **Trusted Computing Base (TCB)** executing in Ring 0 is minimal (seL4 is approximately 9,000 lines of C code, and has been formally mathematically verified to be free of buffer overflows and null pointer dereferences). Drivers run in user space (Ring 3) constrained by hardware page tables and capability tokens. Even if an attacker achieves arbitrary code execution within the disk driver, they remain trapped in Ring 3 and cannot corrupt kernel memory or access unpermitted process address spaces.

---

## 📄 License & Academic Integrity

This project is built as open educational software for Operating Systems coursework and computer architecture laboratories. You are free to fork, customize, and deploy this project for instructional and learning purposes.
