import { useEffect, useState, useRef } from 'react'
import './App.css'

function App() {

  const PRESTIGE_MULTIPLIER = 0.007;

  const loadGame = (upgrade_data) => {
    const saved = localStorage.getItem("idle-everything-progress");
    if (saved) {
      const parsed_save = JSON.parse(saved);
      return applyOfflineProgress(parsed_save);
    }

    var initialGameState = {
      "resources": {
        "atom_count": 0.0,
        "atoms_per_second": 1000.0,
        "prestige_multiplier": 1.0,
        "prestige_to_be_earned": 0.0,
      },
      "ui": {
        "active_bulk_buy": 1,
        "current_group": 0,
        "unlocked_groups": [],
        "current_subgroups": [0, 0]
      },
      "upgrades": [],
      "last_saved": Date.now()
    }

    upgrade_data.groups.forEach((group, id) => {
      initialGameState.ui.unlocked_groups[id] = group.unlock_cost === 0.0 ? true : false;
      group.upgrade_subgroups.forEach(subgroup => {
        subgroup.upgrades.forEach(upgrade => {
          initialGameState.upgrades[upgrade.upgrade_id] = { purchased: 0, name: upgrade.upgrade_name };
        });
      });
    });

    return initialGameState;
  }

  const [upgrades, setUpgrades] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showPageOverlay, setShowPageOverlay] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [offlineAtoms, setOfflineAtoms] = useState(0);

  // Retrieve upgrade definitions
  useEffect(() => {
    fetch("/data/data.json")
      .then(res => res.json())
      .then(data => {setUpgrades(data); setProgress(loadGame(data))})
  }, [])

  // Tick-based (one sec) atom generation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        resources: {
          ...prev.resources,
          atom_count: prev.resources.atom_count + (prev.resources.atoms_per_second * prev.resources.prestige_multiplier)
        }
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [])

  const useAutoSave = (progress) => {
    const progressRef = useRef(progress);

    useEffect(() => {
      progressRef.current = progress;
    }, [progress])
    
    useEffect(() => {
      const saveInterval = setInterval(() => {
        const currentProgress = progressRef.current;
        if (!currentProgress) return;

        localStorage.setItem(
          "idle-everything-progress",
          JSON.stringify({...currentProgress, last_saved: Date.now()})
        );
      }, 5000);
  
      return () => clearInterval(saveInterval);
    }, []);
  }

  // Utility function to format cash amounts to abbreviations if needed
  const formatCash = (n, dp=2) => {
    if (n < 1000) return n.toFixed(dp);
    if (n < 1e3) return n.toFixed(dp);
    if (n < 1e6) return (n / 1e3).toFixed(dp) + "K";
    if (n < 1e9) return (n / 1e6).toFixed(dp) + "M";
    if (n < 1e12) return (n / 1e9).toFixed(dp) + "B";
    if (n < 1e15) return (n / 1e12).toFixed(dp) + "T";
    if (n < 1e18) return (n / 1e15).toFixed(dp) + "Q";
    if (n < 1e21) return (n / 1e18).toFixed(dp) + "Qu";
    if (n < 1e24) return (n / 1e21).toFixed(dp) + "Sx";
  }
  
  const applyOfflineProgress = (progress) => {
    if (!progress.last_saved) return progress;

    const now = Date.now();
    const seconds_since_save = Math.floor((now - progress.last_saved) / 1000);

    if (seconds_since_save > 0) {
      const offline_atoms_earned = progress.resources.atoms_per_second * progress.resources.prestige_multiplier * seconds_since_save;

      setOfflineSeconds(seconds_since_save);
      setOfflineAtoms(offline_atoms_earned);
      toggleModal("offline", true)

      return {
        ...progress,
        resources: {
          ...progress.resources,
          atom_count: progress.resources.atom_count + offline_atoms_earned
        },
        last_saved: now
      }
    }

    return progress;
  }

  const handlePrestige = () => {
    setProgress(prev => ({
      ...prev,
      "resources": {
        "atom_count": 0.0,
        "atoms_per_second": 100.0,
        "prestige_multiplier": prev.resources.prestige_multiplier + prev.resources.prestige_to_be_earned,
        "prestige_to_be_earned": 0.0,
      },
      "ui": {
        ...prev.ui,
        "current_group": 0,
        "unlocked_groups": [],
        "current_subgroups": [0, 0]
      },
      "upgrades": prev.upgrades.map(u => ({ ...u, purchased: 0 })),
    }))

    toggleModal("prestige", false);
  }

  const handleReset = () => {
    localStorage.removeItem("idle-everything-progress");
    fetch("/data/data.json")
      .then(res => res.json())
      .then(data => {setProgress(loadGame(data))})

    toggleModal("reset", false);
  }

  const toggleModal = (modal, toggleMode) => {

    // Always show screen overlay when displaying a modal.
    setShowPageOverlay(toggleMode);

    // Conditional display of modal. Only one modal displayed at any one time.
    switch(modal) {
      case("group"):
        setShowGroupsModal(toggleMode);
        break;
      case("offline"):
        setShowOfflineModal(toggleMode);
        break;
      case("reset"):
        setShowResetModal(toggleMode);
        break;
      case("prestige"):
        setShowPrestigeModal(toggleMode);
        break;
    }
  }

  const openGroup = (id, cost) => {

    // Check if there are enough atoms to unlock the group
    if (upgrades.atom_count < cost) return;

    const unlocked_groups = progress.ui.unlocked_groups;
    unlocked_groups[id] = true;

    setProgress(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        atom_count: prev.resources.atom_count - cost
      },
      ui: {
        ...prev.ui,
        current_group: id,
        unlocked_groups: unlocked_groups
      }
    }))

  } 

  const selectSubGroup = (subgroup_id) => {
    setProgress(prev => {
      const active_subgroups = [...prev.ui.current_subgroups];
      active_subgroups[prev.ui.current_group] = subgroup_id;
      return {
        ...prev,
        ui: {
          ...prev.ui,
          current_subgroups: active_subgroups
        }
      };
    });
  }
  
  const selectBulkOption = (bulk_option) => {
    setProgress(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        active_bulk_buy: bulk_option
      }
    }))
  }

  const calculateUpgradeCost = (base_cost, exponent, purchased) => {
    const bulk = progress.ui.active_bulk_buy;
    if (bulk === 1) return base_cost * Math.pow(exponent, purchased);

    return base_cost * (Math.pow(exponent, purchased + bulk) - Math.pow(exponent, purchased)) / (exponent - 1);
  }

  const calculatePurchaseableAmount = (cap, purchased) => {
    const bulk = progress.ui.active_bulk_buy;

    return Math.min(bulk, cap-purchased);
  }

  const purchaseUpgrade = (upgrade_id, upgrade_cost, atom_production, amount) => {
    const curr_upgrades = progress.upgrades;
    curr_upgrades[upgrade_id].purchased = curr_upgrades[upgrade_id].purchased + amount

    const unlocked_count = Object.values(progress.upgrades).filter(u => u.purchased > 1).length;

    setProgress(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        atom_count: prev.resources.atom_count - upgrade_cost,
        atoms_per_second: prev.resources.atoms_per_second + (atom_production * amount),
        prestige_to_be_earned: unlocked_count * PRESTIGE_MULTIPLIER
      },
      upgrades: curr_upgrades
    }));
  }

  const upgradeCanBePurchased = (requirements, cost, max_purchaseable) => {

    if (cost > progress.resources.atom_count) return false;
    if (max_purchaseable === 0) return false;

    for (const [upgrade_id, amount] of requirements) {
      if (progress.upgrades[upgrade_id].purchased < amount) return false;
    }

    return true;
  }

  const renderUpgrades = () => {
    const curr_group = progress.ui.current_group;
    const curr_subgroup = progress.ui.current_subgroups[curr_group];

    return upgrades.groups[curr_group].upgrade_subgroups[curr_subgroup].upgrades.map(
      (upgrade, id) => {
        const cost = calculateUpgradeCost(
          upgrade.base_cost,
          upgrade.cost_increase_exponent,
          progress.upgrades[upgrade.upgrade_id].purchased
        );

        const max_purchaseable = calculatePurchaseableAmount(
          upgrade.upgrade_cap,
          progress.upgrades[upgrade.upgrade_id].purchased
        )

        return (
          <div className='single-upgrade-container'>
            <button
              key={`upg${id}`}
              className={`upgrade-btn ${!upgradeCanBePurchased(upgrade.requires, cost, max_purchaseable) && 'upgrade-btn-disabled'}`}
              onClick={() => purchaseUpgrade(upgrade.upgrade_id, cost, upgrade.atom_production, max_purchaseable)}
            >
              {upgrade.upgrade_name} ({progress.upgrades[upgrade.upgrade_id].purchased} / {upgrade.upgrade_cap})<br/>
              Cost: {formatCash(cost)} ⚛&nbsp;
              Produces {formatCash(upgrade.atom_production*progress.ui.active_bulk_buy)} ⚛<br/>
              + {max_purchaseable}
            </button>
            <div className='upgrade-requirements' key={`req${id}`}>
              Requires: <br/>
              <ul>
                {
                  upgrade.requires.map((req, id) => <li key={id}>
                    {req[1]} {progress.upgrades[req[0]].name}
                  </li>)
                }
              </ul>
            </div>
          </div>
        )
      }
    );
  };

  const renderBulkBuyOptions = () => {
    const bulk_options = upgrades.bulk_buy_options;
    const active_bulk_buy = progress.ui.active_bulk_buy;

    return bulk_options.map(
      (option, id) => (
        <button
          key={id}
          className={`bulk-buy-btn ${active_bulk_buy === option && 'bulk-buy-btn-active'}`}
          onClick={() => selectBulkOption(option)}
        >
          {option}×
        </button>
      )
    )
  }

  useAutoSave(progress);

  return (
    upgrades && (
      <>
        {/* Page Overlay */}
        {showPageOverlay && <div className='page-overlay'></div>}
        {/* End Page Overlay */}

        {/* Header */}
        <button className='reset-btn' onClick={() => toggleModal("reset", true)}>Reset Game</button>
        <h1 className='atom-count'>{formatCash(progress.resources.atom_count)} ⚛</h1>
        <p className='atom-per-second'>{formatCash(progress.resources.atoms_per_second * progress.resources.prestige_multiplier)} ⚛ per second (multiplied by ×{formatCash(progress.resources.prestige_multiplier, 3)})</p>
        {/* End of Header */}

        {/* Reset Modal */}
        {showResetModal && <div className='reset-modal-container'>
          <div className='reset-modal'>
            <div className='reset-modal-content'>
              Are you sure you want to reset your progress?
            </div>
            <div className='reset-modal-buttons'>
              <button onClick={() => toggleModal("reset", false)}>Cancel</button>
              <button onClick={handleReset}>Reset</button>
            </div>
          </div>
        </div>}
        {/* End Reset Modal */}

        {/* Prestige Modal */}
        {showPrestigeModal && <div className='prestige-modal-container'>
          <div className='prestige-modal'>
            <div className='prestige-modal-content'>
              Are you sure you want to prestige?
            </div>
            <div className='prestige-modal-buttons'>
              <button onClick={() => toggleModal("prestige", false)}>Cancel</button>
              <button onClick={handlePrestige}>prestige</button>
            </div>
          </div>
        </div>}
        {/* End Prestige Modal */}

        {/* Offline Modal */}
        {showOfflineModal && <div className='offline-modal-container'>
          <div className='offline-modal'>
            <div className='offline-modal-content'>
              You were gone for {offlineSeconds} seconds.<br/>
              You earned {formatCash(offlineAtoms)} ⚛ while you were away.
            </div>
            <div className='offline-modal-buttons'>
              <button onClick={() => toggleModal("offline", false)}>Close</button>
            </div>
          </div>
        </div>}
        {/* End Offline Modal */}

        {/* Prestige Button */}
        <div className='prestige-btn-container'>
          <button className='prestige-btn' onClick={() => toggleModal("prestige", true)}>Prestige</button>
          <p>You will gain a +{formatCash(progress.resources.prestige_to_be_earned, 3)} multiplier</p>
        </div>
        {/* End of Prestige Button */}

        {/* Group Modal */}
        <div className='group-modal-btn-container'>
          <button 
            className='group-modal-trigger'
            onClick={() => {toggleModal("group", true)}}
          >Groups</button>
        </div>
        {showGroupsModal && <div className='group-modal-container'>
          <div className='group-modal'>
            <div className='group-modal-header'>
              <button onClick={() => toggleModal("group", false)}>Close</button>
              <h3>Groups</h3>
            </div>
            <div className='group-modal-content'>
              {
                upgrades.groups.map((group, id) => {
                  return (
                    <div className='group-modal-group' key={id}>
                      <button 
                        className='group-modal-button'
                        onClick={() => openGroup(id, group.unlock_cost)}
                      >
                        {group.group_name}<br/>
                        {
                          !progress.ui.unlocked_groups[id] &&
                          `Cost: ${formatCash(group.unlock_cost)}`
                        }
                      </button>
                    </div>
                  )
                })
              }
            </div>
          </div>
        </div>}
        {/* End of Group Modal */}

        {/* Subgroups */}
        <div className='subgroup-container'>
          <div className='subgroups'>
            {
              upgrades.groups[progress.ui.current_group].upgrade_subgroups.map((subgroup, id) => {
                return (
                  <button 
                    key={id}
                    className='subgroup-btn'
                    onClick={() => selectSubGroup(id)}
                  >{subgroup.subgroup_name}</button>
                )
              })
            }
          </div>
        </div>
        {/* End of Subgroups */}

        {/* Upgrades Group */}
        <div className='upgrades-container'>
          <div className='bulk-buy'>
            <span>Buy: </span>
            {renderBulkBuyOptions()}
          </div>
          <div className='upgrades'>
            {renderUpgrades()}
          </div>
        </div>
        {/* End of Upgrades Group */}
      </>
    )
  )
}

export default App
