import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState } from "preact/hooks";

const tabs = [
  { key: "earned", label: "Loyalty Points Earned" },
  { key: "redeemed", label: "Redeem Points History" },
  { key: "refer", label: "Refer Your Friend" },
  { key: "giftcard", label: "Generate Gift Card" },
  { key: "tiers", label: "Loyalty Tiers" },
  { key: "profile", label: "Update Profile" },
];

const styles = {
  shell: {
    border: "1px solid #d9d9d9",
    background: "#fff",
    padding: "12px",
    fontFamily: "Arial, sans-serif",
  },
  heading: {
    margin: "0 0 10px",
    fontSize: "32px",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "14px",
  },
  navWrap: {
    border: "1px solid #d9d9d9",
  },
  navItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    border: "none",
    borderBottom: "1px solid #d9d9d9",
    background: "#fff",
    textDecoration: "underline",
    fontSize: "17px",
    cursor: "pointer",
    color: "#2f3a44",
  },
  navItemActive: {
    background: "#ececec",
    fontWeight: 700,
  },
  panel: {
    border: "1px solid #d9d9d9",
    padding: "12px",
  },
  title: {
    margin: "0 0 10px",
    fontSize: "30px",
    fontWeight: 700,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  cell: {
    border: "1px solid #d9d9d9",
    padding: "10px",
    textAlign: "left",
    fontSize: "16px",
  },
  input: {
    width: "100%",
    border: "1px solid #cfcfcf",
    padding: "10px",
    marginBottom: "8px",
    fontSize: "16px",
  },
  button: {
    border: "1px solid #2c2c2c",
    background: "#fff",
    padding: "10px 14px",
    fontSize: "16px",
    cursor: "pointer",
  },
};

function SkeletonTable({ columns }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} style={{ ...styles.cell, fontWeight: 700 }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[1, 2, 3].map((row) => (
          <tr key={row}>
            {columns.map((col) => (
              <td key={`${row}-${col}`} style={styles.cell}>-</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RightContent({ active }) {
  if (active === "earned") {
    return (
      <>
        <h3 style={styles.title}>Loyalty Points Earned</h3>
        <SkeletonTable columns={["Date", "Activity Performed", "Reference ID", "Points Earned"]} />
      </>
    );
  }

  if (active === "redeemed") {
    return (
      <>
        <h3 style={styles.title}>Redeem Points History</h3>
        <SkeletonTable columns={["Date", "Activity Performed", "Reference ID", "Points Redeemed", "Amount"]} />
      </>
    );
  }

  if (active === "refer") {
    return (
      <>
        <h3 style={styles.title}>Refer Your Friend</h3>
        <p>Share your code with your friend.</p>
        <p>Your Code: ----------</p>
        <input style={styles.input} placeholder="Enter email here..." />
        <button style={styles.button}>Share & Earn</button>
      </>
    );
  }

  if (active === "giftcard") {
    return (
      <>
        <h3 style={styles.title}>Generate Gift Card</h3>
        <p>Points Available: ---- | Max Amount: ----</p>
        <input style={styles.input} placeholder="Points to redeem" />
        <input style={styles.input} placeholder="Receiver's Email" />
        <button style={styles.button}>Generate Gift Card</button>
      </>
    );
  }

  if (active === "tiers") {
    return (
      <>
        <h3 style={styles.title}>Loyalty Tiers</h3>
        <SkeletonTable columns={["Tier Name", "Level", "Points Range", "Multiplier"]} />
      </>
    );
  }

  return (
    <>
      <h3 style={styles.title}>Update Profile</h3>
      <p>Date of Birth: --------</p>
      <p>Anniversary: --------</p>
      <input style={styles.input} placeholder="Referral Code" />
      <button style={styles.button}>Save Referral Code</button>
    </>
  );
}

function LoyaltyRewardsProfileSection() {
  const [activeTab, setActiveTab] = useState("earned");

  return (
    <div style={styles.shell}>
      <h2 style={{ margin: "0 0 10px", fontSize: "36px", textDecoration: "underline" }}>
        Loyalty Rewards Information
      </h2>

      <div style={styles.grid}>
        <div style={styles.navWrap}>
          {tabs.map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...styles.navItem,
                ...(activeTab === tab.key ? styles.navItemActive : {}),
                borderBottom: idx === tabs.length - 1 ? "none" : styles.navItem.borderBottom,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.panel}>
          <RightContent active={activeTab} />
        </div>
      </div>
    </div>
  );
}

export default async () => {
  render(<LoyaltyRewardsProfileSection />, document.body);
};
