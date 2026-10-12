import {Document,Page,Text,View,StyleSheet} from "@react-pdf/renderer";
import type {PostMatchReport} from "./post-match";
import {evaluateExact,evaluateOutcome} from "./post-match";
import {historicalClassification,legacyNote,officialNote,pickOutcome} from "./historical";
const s=StyleSheet.create({page:{padding:40,paddingBottom:60,fontFamily:"Helvetica",fontSize:10,color:"#102b50",lineHeight:1.6},brand:{color:"#125cc2",fontSize:12,marginBottom:18},title:{fontSize:23,marginBottom:12},heading:{fontSize:15,marginTop:18,marginBottom:8},box:{backgroundColor:"#f0f6ff",padding:14,marginVertical:12},row:{marginBottom:8},footer:{position:"absolute",bottom:25,left:40,right:40,fontSize:8,color:"#526783"}});
export function HistoricalMatchPdf({report:r}:{report:PostMatchReport}) {
 const p=r.premium,free=r.free,score=p?.score_forecast?.most_likely_score;
 return <Document title={`${r.homeTeam} vs ${r.awayTeam} Match Report`} author="Predictive Compass"><Page size="A4" style={s.page}>
 <Text style={s.brand}>PREDICTIVE COMPASS</Text><Text style={s.title}>{r.homeTeam} {r.finalScore.home} - {r.finalScore.away} {r.awayTeam}</Text><Text>{r.competition} | FINAL</Text><Text>{r.kickoffAt??"Kickoff unavailable"}</Text>
 <Text style={s.heading}>Premium Pre-Match Intelligence</Text>{p?<>
 <View style={s.box}><Text>{historicalClassification(p)}</Text><Text>{p.access_status==="LEGACY_PREMATCH"?legacyNote:officialNote}</Text></View>
 <Text>Compass Pick: {p.compass_pick?.selection??"Unavailable"} | {evaluateOutcome(pickOutcome(p.compass_pick?.selection,r.homeTeam,r.awayTeam),r.finalScore)}</Text>
 <Text>Model probability: {p.compass_pick?`${p.compass_pick.model_probability}%`:"Unavailable"}</Text>
 <Text>Predicted score: {score?`${score.home}-${score.away}`:"Unavailable"} | Exact score: {evaluateExact(score,r.finalScore)}</Text>
 <Text>Exact-score probability: {p.score_forecast?.score_probability==null?"Unavailable":`${p.score_forecast.score_probability}%`}</Text>
 <Text>{p.probabilities?`${r.homeTeam} ${p.probabilities.home_win}% | Draw ${p.probabilities.draw}% | ${r.awayTeam} ${p.probabilities.away_win}%`:"Probabilities unavailable"}</Text>
 <Text>Recommendation: {p.recommendation_strength?.label??"Unavailable"}</Text>
 <Text style={s.heading}>Bookmaker vs Compass</Text>{p.bookmaker_comparison.length?p.bookmaker_comparison.map((b,i)=><Text key={i} style={s.row}>{b.selection}: Bookmaker {b.bookmaker_implied_probability}% / Compass {b.compass_probability}%; fair odds {b.bookmaker_consensus_fair_odds} / {b.compass_fair_odds}; difference {b.probability_difference} percentage points.</Text>):<Text>Unavailable</Text>}
 <Text style={s.heading}>Intelligence Reasons</Text>{p.intelligence_reasons.length?p.intelligence_reasons.map((reason,i)=><Text key={i} style={s.row}>{reason.category}: {reason.summary}</Text>):<Text>Unavailable</Text>}
 <Text>Forecast change: unavailable in historical snapshot.</Text><Text>Generated: {p.generated_at??"Unavailable"}</Text><Text>Frozen evidence cutoff: {p.evidence_cutoff_at??"Unavailable"}</Text>
 </>:<Text>{r.premiumUnlocked?"No frozen Premium snapshot is available.":"Premium historical intelligence requires match ownership."}</Text>}
 <Text style={s.heading}>Free Pre-Match Forecast</Text>{free?.status==="available"?<><Text>{free.predicted_outcome==="draw"?"Draw":`${free.predicted_outcome==="home_win"?r.homeTeam:r.awayTeam} Win`} | {free.probabilities[free.predicted_outcome]}% | {evaluateOutcome(free.predicted_outcome,r.finalScore)}</Text><Text>Generated: {free.generated_at}</Text></>:<Text>No immutable Free forecast is available.</Text>}
 <Text style={s.heading}>Live / Halftime History</Text>{r.history?.length?r.history.map((h,i)=><View key={i} style={s.row} wrap={false}><Text>{h.stage.replaceAll("_"," ")} | {h.generated_at??"Timestamp unavailable"}</Text><Text>{h.change_description}</Text><Text>{r.homeTeam} {h.probabilities.home_win}% | Draw {h.probabilities.draw}% | {r.awayTeam} {h.probabilities.away_win}%</Text><Text>Stored score forecast: {h.predicted_score?`${h.predicted_score.home}-${h.predicted_score.away}`:"Unavailable"}</Text></View>):<Text>{r.premiumUnlocked?"No live intelligence was recorded for this match.":"Live history requires match ownership."}</Text>}
 <Text fixed style={s.footer} render={({pageNumber,totalPages})=>`Predictive Compass | Historical match report | ${pageNumber} / ${totalPages}`}/>
 </Page></Document>;
}
