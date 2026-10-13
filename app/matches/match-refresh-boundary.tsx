"use client";
import {useState, type ReactNode} from "react";
import {AutomaticRefresh} from "../automatic-refresh";

type Props={children:ReactNode;state:"current"|"transient"|"hidden"|"final";kickoff?:string|null;ready?:boolean;interval?:number};
// Retains only content already authorized by this page's server read. An explicit
// hidden decision clears it. Access revocation also supplies hidden, never transient.
export function MatchRefreshBoundary(props:Props){
  const [saved,setSaved]=useState<{input:ReactNode;content:ReactNode|null;kickoff:string|null}>({input:props.children,content:props.state==="current"||props.state==="final"?props.children:null,kickoff:props.kickoff??null});
  if(saved.input!==props.children)setSaved({input:props.children,content:props.state==="transient"?saved.content:props.state==="current"||props.state==="final"?props.children:null,kickoff:props.kickoff??saved.kickoff});
  return <><AutomaticRefresh kickoff={props.kickoff??saved.kickoff} ready={props.ready} interval={props.interval??(props.state==="final"?300000:undefined)}/>{props.state==="transient"&&saved.content?<><p className="service-state" role="status">Match update temporarily delayed. Your available intelligence and ownership are preserved.</p>{saved.content}</>:props.children}</>;
}
