'use client'

import type { ActionFunctionArgs } from "react-router";
import { data as json } from "react-router";
import { getNetworkClient } from "~/network/client";
import { exportGroupAsBassline, exportNetworkAsBassline, serializeBassline } from '@bassline/bassline';
import type { NetworkState } from '@bassline/core';

export async function clientAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const groupId = formData.get("groupId") as string || "root";
  const includeValues = formData.get("includeValues") === "true";
  const exportAll = formData.get("exportAll") === "true";
  
  try {
    const client = getNetworkClient();
    
    if (exportAll && groupId === "root") {
      // Export entire network
      const rootState = await client.getState("root");
      const groups = new Map();
      groups.set("root", rootState);
      
      // Get all subgroups recursively
      const visited = new Set<string>();
      const queue = [...rootState.group.subgroupIds];
      
      while (queue.length > 0) {
        const subgroupId = queue.shift()!;
        if (visited.has(subgroupId)) continue;
        visited.add(subgroupId);
        
        try {
          const subState = await client.getState(subgroupId);
          groups.set(subgroupId, subState);
          queue.push(...subState.group.subgroupIds);
        } catch (e) {
          console.warn(`Failed to get state for subgroup ${subgroupId}:`, e);
        }
      }
      
      const networkState: NetworkState = {
        groups,
        currentGroupId: groupId,
        rootGroupId: "root"
      };
      
      const bassline = exportNetworkAsBassline(networkState, { includeValues });
      
      // Add metadata with user info
      const userManager = (await import('~/lib/user-manager')).userManager;
      const currentUser = userManager.getCurrentUser();
      
      bassline.metadata = {
        ...bassline.metadata,
        author: currentUser?.name || "Anonymous",
        authorProfile: currentUser ? userManager.getProfileData(currentUser) : undefined,
        created: new Date().toISOString(),
        tags: ["exported"]
      };
      
      // Add to user's authored list
      if (currentUser && bassline.name) {
        userManager.addAuthoredBassline(bassline.name);
      }
      
      return json({
        success: true,
        bassline: serializeBassline(bassline),
        filename: `${bassline.name || "network"}.bassline.json`
      });
    } else {
      // Export single group
      const groupState = await client.getState(groupId);
      const bassline = exportGroupAsBassline(
        groupState.group,
        groupState,
        { includeValues }
      );
      
      // Add metadata with user info
      const userManager = (await import('~/lib/user-manager')).userManager;
      const currentUser = userManager.getCurrentUser();
      
      bassline.metadata = {
        ...bassline.metadata,
        author: currentUser?.name || "Anonymous",
        authorProfile: currentUser ? userManager.getProfileData(currentUser) : undefined,
        created: new Date().toISOString(),
        tags: ["exported"]
      };
      
      // Add to user's authored list
      if (currentUser && bassline.name) {
        userManager.addAuthoredBassline(bassline.name);
      }
      
      return json({
        success: true,
        bassline: serializeBassline(bassline),
        filename: `${bassline.name || groupId}.bassline.json`
      });
    }
  } catch (error) {
    console.error("Export failed:", error);
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Export failed" 
      },
      { status: 500 }
    );
  }
}