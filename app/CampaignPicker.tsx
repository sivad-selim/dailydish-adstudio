"use client";

import { useEffect, useState } from "react";
import { getCampaignTitle, type Campaign } from "../firebase/campaigns";
import { subscribeToCampaignFolders, type CampaignFolder } from "../firebase/campaignFolders";
import { Dropdown } from "./Dropdown";

type CampaignPickerProps = {
  campaigns: Campaign[];
  value: string;
  onChange: (id: string) => void;
};

export function CampaignPicker({ campaigns, value, onChange }: CampaignPickerProps) {
  const [folders, setFolders] = useState<CampaignFolder[]>([]);
  const [folderId, setFolderId] = useState("all");
  const [sort, setSort] = useState("date");
  const [folderError, setFolderError] = useState("");

  useEffect(() => subscribeToCampaignFolders(
    (nextFolders) => {
      setFolders(nextFolders);
      setFolderError("");
      setFolderId((current) => current === "all" || current === "" || nextFolders.some((folder) => folder.id === current) ? current : "all");
    },
    () => setFolderError("Les dossiers n’ont pas pu être chargés."),
  ), []);

  // The subscription already returns campaigns by updatedAt descending.
  const visibleCampaigns = campaigns.filter((campaign) => folderId === "all" || (campaign.folderId ?? "") === folderId);
  if (sort !== "date") {
    visibleCampaigns.sort((a, b) => {
      const comparison = getCampaignTitle(a).localeCompare(getCampaignTitle(b), "fr", { sensitivity: "base", numeric: true });
      return sort === "az" ? comparison : -comparison;
    });
  }
  const selectedOutsideFolder = campaigns.find((campaign) => campaign.id === value && !visibleCampaigns.some((visible) => visible.id === value));

  return (
    <div className="campaign-picker">
      <div className="campaign-picker-filters">
        <div>
          <label className="field-label" htmlFor="studio-campaign-folder">Dossier</label>
          <Dropdown id="studio-campaign-folder" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="all">Tous les dossiers</option>
            <option value="">Sans dossier</option>
            {folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
          </Dropdown>
        </div>
        <div>
          <label className="field-label" htmlFor="studio-campaign-sort">Trier par</label>
          <Dropdown id="studio-campaign-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="date">Date de modification</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </Dropdown>
        </div>
      </div>
      {folderError && <p className="campaign-picker-message" role="alert">{folderError}</p>}
      <label className="field-label" htmlFor="studio-campaign">Campagne</label>
      <Dropdown id="studio-campaign" wrapperClassName="campaign-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choisir une campagne</option>
        {/* Keep the assigned campaign displayed without adding it to the filtered choices. */}
        {selectedOutsideFolder && <option value={value} hidden>{getCampaignTitle(selectedOutsideFolder)} (hors dossier)</option>}
        {visibleCampaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{getCampaignTitle(campaign)}</option>)}
      </Dropdown>
      {visibleCampaigns.length === 0 && <p className="campaign-picker-message">Aucune campagne dans ce dossier.</p>}
    </div>
  );
}
