import numpy as np, pandas as pd, json
rng = np.random.default_rng(520)
N = 100
capability=rng.normal(0,1,N); conscientious=rng.normal(0,1,N); ses=rng.normal(0,1,N)
hs_gpa=np.clip(2.4+0.5*capability+0.2*conscientious+rng.normal(0,0.25,N),1.5,4.0).round(2)
hs_gpa_z=(hs_gpa-hs_gpa.mean())/hs_gpa.std()
hs_clubs=np.clip((2.0+1.1*hs_gpa_z+rng.normal(0,0.6,N)).round(),0,6).astype(int)
hs_sports=(rng.uniform(0,1,N)<np.clip(0.45+0.10*hs_gpa_z,0.05,0.95)).astype(int)
hs_attendance=np.clip(0.90+0.04*conscientious+rng.normal(0,0.03,N),0.7,1.0).round(3)
hs_pop_density=np.clip(3500-600*ses+rng.normal(0,500,N),200,9000).round().astype(int)
need_based_aid=(rng.uniform(0,1,N)<np.clip(0.5-0.20*ses,0.05,0.95)).astype(int)
ug_gpa=np.clip(2.5+0.45*capability+0.25*conscientious+rng.normal(0,0.3,N),1.5,4.0).round(2)
internships=np.clip((0.6*conscientious+0.4*ses+rng.normal(0,0.7,N)).round(),0,4).clip(0,None).astype(int)
logins_per_week=np.clip(2.5+1.6*conscientious+0.4*capability+rng.normal(0,0.6,N),0,12).round(1)
time_on_task_hrs=np.clip(3.0+1.8*conscientious+0.5*capability+rng.normal(0,0.8,N),0,15).round(1)
submission_rate=np.clip(0.78+0.10*conscientious+0.05*capability+rng.normal(0,0.05,N),0.3,1.0).round(3)
outcome_latent=(0.50*capability+0.80*conscientious+0.45*ses+rng.normal(0,0.35,N))
course_score=np.clip(70+9*outcome_latent+rng.normal(0,3,N),40,100).round(1)
success=(outcome_latent>np.quantile(outcome_latent,0.40)).astype(int)
df=pd.DataFrame({'student_id':np.arange(1001,1001+N),'hs_gpa':hs_gpa,'hs_clubs':hs_clubs,'hs_sports':hs_sports,
  'hs_attendance':hs_attendance,'hs_pop_density':hs_pop_density,'need_based_aid':need_based_aid,'ug_gpa':ug_gpa,
  'internships':internships,'logins_per_week':logins_per_week,'time_on_task_hrs':time_on_task_hrs,
  'submission_rate':submission_rate,'course_score':course_score,'success':success})
# quirks
miss=rng.uniform(0,1,N)<np.where(success==0,0.22,0.06)
for c in ['logins_per_week','time_on_task_hrs','submission_rate']: df.loc[miss,c]=np.nan
df['submission_rate']=df['submission_rate'].apply(lambda v: f"{round(v*100)}%" if pd.notna(v) else "")
dupes=df.iloc[[3,17]].copy(); df=pd.concat([df,dupes],ignore_index=True)
df.loc[7,'hs_attendance']=1.4

# Emit as compact Python list-of-tuples (what we embed in the sim).
# Use "" for NaN-floats and keep submission_rate as the '%' string.
cols=list(df.columns)
def cell(v):
    if isinstance(v,float) and (v!=v): return 'None'
    if isinstance(v,str): return repr(v)
    if isinstance(v,(np.integer,)): return str(int(v))
    if isinstance(v,(np.floating,)): return repr(round(float(v),3))
    return repr(v)
rows=[]
for _,r in df.iterrows():
    rows.append("("+", ".join(cell(r[c]) for c in cols)+")")
out = "COLS = " + json.dumps(cols) + "\n"
out += "RAW = [\n  " + ",\n  ".join(rows) + "\n]\n"
open("cohort_frozen.py","w").write(out)
print("rows:",len(df),"cols:",len(cols))
print("size (chars):",len(out))
print("\nfirst 2 rows:\n",rows[0],"\n",rows[1])
print("\ncols:",cols)
